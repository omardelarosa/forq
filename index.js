/* jshint loopfunc: true */

var async = require('async');
var fork = require('child_process').fork;
var _ = require('lodash');
var BATCH_TIMEOUT = 2000;
var debug = require('debug')('forq');
var d = require('domain').create();
var os = require('os');
var util = require('util');
var Errors = require('./errors');
var EventEmitter = require('events').EventEmitter;
var DEFAULT_CONCURRENCY = 3;
var NUM_CPUS = os.cpus().length;
var DEFAULT_WORKER_OPTIONS = {
  stdio: [0, 0, 'pipe' ]
};
var DEFAULT_TIMEOUT = 60000;
var DEFAULT_POLLING_FREQUENCY = 1000;

function __attachEventListeners () {

  var standard_fork_event_names = [ 'error', 'exit', 'disconnect', 'message' ];
  var f = this;
  var events = this.events;
  var w = this.worker;
  var eventName;
  
  var customEvents = _.each(events, function(v, k) {
    if ( !_.includes(standard_fork_event_names, k) ) {
      return v;
    }
  });

  var standardEvents = _.each(events, function(v, k) {
    if ( _.includes(standard_fork_event_names, k) ) {
      return v;
    }
  });

  function defaultEndHandler () {
    if (f.connected) {
      f.send({ event: 'finished', data: {} });
    }
  }

  for (eventName in standardEvents) {
    f.on(eventName, standardEvents[eventName]);
  }

  for (eventName in customEvents) {
    f.addListener('message', function (msg){
      if (msg.event && msg.event === eventName) {
        customEvents[eventName].apply(f, [ msg.data ]);
      }
    });
  }

  // add default events
  f.addListener('exit', function(code, err){
    var errorObj, d;
    if (code !== 0) {
      errorObj = new Errors.ForkError('fork "'+f.id+'" threw an error with code '+code);
      f.emit('error', errorObj);
      // emit a general worker error
      f.pool.emit('workerError', errorObj );
      // emit a namespaced error for the individual worker
      f.pool.emit('workerError:'+f.id, errorObj);
    }
    if (f.connected) {
      // signal termination via pseudo-event
      // send error obj if one exists
      if (errorObj) {
        d = errorObj.toObject();
      } else {
        errorObj = null;
        d = {};
      }
      f.send({ event: 'finished', data: d });
    } else {
      // terminate
      f.terminate(errorObj);
    }
  });

  f.addListener('disconnect', function(){
    // terminate
    f.terminate();
  });

  f.addListener('message', function(){
    var msg = arguments[0];
    if (msg.event && msg.event === 'finished') {
      debug("finished");
      f.terminate(msg.data);
    // soft error handling
    } else if (msg.event && msg.event === 'softError') {
      var er = new Errors.SoftError(msg.data);
      // emit a normal error event on the fork passing in softError as object
      f.emit('error', er);
      f.terminate( er );
    }
  });

  return f;
}

function __assignForkId () {
  var w = this.worker;
  function hid(){ return Date.now().toString('16').slice(2); }
  var id = w.id ? w.id : hid();

  if (!this.pool.forksHash[id]) {
    this.id = id;
  } else {
    this.id = hid();
  }
}

function __setForkTimer (f) {
  return setInterval(function(){
    var currentTime = Date.now();
    if (currentTime - f.startTime > f.killTimeout) {
      clearInterval(f.timer);
      f.terminate(new Error('Time out'));
      if (f.connected && f.kill) {
        f.kill();
      }
    }
  }, f.pollFrequency || DEFAULT_POLLING_FREQUENCY );
}

// initialization
function Forq (opts) {
  if (!opts) { opts = {}; }
  var self = this;

  this.opts = opts;
  this.concurrencyLimit = this.opts.concurrency || DEFAULT_CONCURRENCY;
  this.domain = d;
  this.killTimeout = opts.killTimeout || DEFAULT_TIMEOUT;
  this.pollFrequency = opts.pollFrequency || DEFAULT_POLLING_FREQUENCY;
  // cap concurrency at the number of CPUS
  if (this.concurrencyLimit > NUM_CPUS) {
    debug('warning: concurrency will be limited at the number of CPU cores of '+NUM_CPUS);
    this.concurrencyLimit = NUM_CPUS;
  }
  this.startTime = Date.now();
  this.workers = this.opts.workers || [];
  this.events = opts.events || {};
  this.oninit = opts.oninit ? opts.oninit.bind(this) : function () { return this; };
  var q = async.queue(function(task, done){
    task.action(done);
  }, this.concurrencyLimit); // make queue;
  this.queue = q; // attach queue to pool
  this.errors = {};
  this.forksHash = {};
  this.forks = [];
  this.data = {};

  // start pool timer
  this.__setPoolTimer();

  this.queue.drain = (function(res) {
    debug("finished all tasks and calling drain");
    if (this.opts.drain && this.opts.drain.constructor === Function) {
      this.opts.drain.call(this, pool);
    }
  }).bind(this);

  this.__onfinish = (function(res) {
    debug('finished closing all active forks in pool');
    if (this.opts.onfinished && this.opts.onfinished.constructor === Function) {
      this.opts.onfinished.call(this, res);
    }
  }).bind(this);

  this.on('finished', this.__onfinish);

}

// inherit from EventEmitter
util.inherits(Forq, EventEmitter);

Forq.prototype.__setPoolTimer = function () {
  var self = this;
  this.timer = setInterval(function(){
    var currentTime = Date.now();
    debug("currently active forks in pool", self.getNumberOfActiveForks() );
    if (self.getNumberOfActiveForks() === 0) {
      clearInterval(self.timer);
      self.emit('finished', { status: 'completed' });
    } else if (currentTime - self.startTime > self.killTimeout) {
      clearInterval(self.timer);
      self.killAll();
      self.emit('finished', { status: 'aborted' });
    } else {
      debug('pool is waiting for forks to terminate');
    }
  }, self.pollFrequency);
};

Forq.prototype.getNumberOfActiveForks = function() {
  if ( this.forks && this.forks.length > 0 ) {
    return this.forks.filter(function(f){ return !f.terminated; }).length;
  }
};

Forq.prototype.run = function () {
  var self = this;
  this.killAll(); // kill any existing forks

  function startFork(worker) {
    var w = worker;
    var ctx = this;
    return function(done) {

      function terminate (err) {
        var e = err ? err : null;
        clearInterval(this.timer);
        if (!this.terminated) {
          debug('terminated worker '+this.id);
          this.terminated = true;
          if (this.connected) { this.emit('terminated'); }
          if (this.cb) { this.cb(e); }
        }
      }

      var fork_args = [w.path, w.args];

      if (w.opts) {
        fork_args.push(w.opts);
      } else {
        // use default worker options
        fork_args.push(DEFAULT_WORKER_OPTIONS);
      }

      // create the forked process
      var f = fork.apply(this, fork_args);

      // access fork object from context
      this.f = f;

      // store start time of fork
      f.startTime = Date.now();

      // access pool from fork
      f.pool = self;

      // attach worker to fork
      f.worker = w;
      
      // set killTimeout of fork
      f.killTimeout = w.killTimeout || DEFAULT_TIMEOUT;

      f.pollFrequency = w.pollFrequency || DEFAULT_POLLING_FREQUENCY;

      // store callback
      f.cb = done;

      // store events from pool
      f.events = self.events || {};

      // add fork to the domain
      d.add(f);

      // set terminate method
      f.terminate = terminate.bind(f);

      // set timer for timeouts, etc.
      f.timer = __setForkTimer(f);

      // assign event handlers
      __attachEventListeners.apply(f);

      // assign fork id
      __assignForkId.apply(f);

      f.terminated = false;
      f.hasFinished = false;
      
      // add to forks hash
      self.forksHash[f.id] = f;
      
      // create empty array to hold errors for this fork
      self.errors[f.id] = [];

      // add to forks array
      self.forks.push(f);

    };
  }

  // store domain errors
  d.on('error', function (er) {
    if ( er.domainEmitter && self.errors[er.domainEmitter.id] ) {
      self.errors[er.domainEmitter.id].push(er);
      self.emit('error', er);
    }
  });

  this.workers.forEach(function(w){
    self.queue.push({
      action: startFork(w)
    }, function(err){
      // log errors processing forks
      if (err) {
        // TODO: listen and broadcast for these errors in a stable way
      }
    });
  });

  this.oninit();

  return this;
};

Forq.prototype.killAll = function () {
  if (this.forks) {
    if (this.forks.length > 0) {
      // send a kill signal and terminate each
      this.forks.forEach(function(f){ 
        if (f.connected && f.kill) {
          f.kill(); 
        }
        f.terminate(); 
      });
    }
    this.forks = [];
    this.forksHash = {};
  }
};

Forq.Errors = Errors;
module.exports = Forq;