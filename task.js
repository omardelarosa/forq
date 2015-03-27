/* jshint loopfunc: true */

var os = require('os');
var fork = require('child_process').fork;
var debug = require('debug')('task');
var _ = require('lodash');
var Errors = require('./errors');
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
      f.queue.emit('workerError', errorObj );
      // emit a namespaced error for the individual worker
      f.queue.emit('workerError:'+f.id, errorObj);
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
  var w = this.work;
  function hid(){ return Date.now().toString('16').slice(2); }
  var id = w.id ? w.id : hid();

  if (!this.queue.forksHash[id]) {
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

function Task (w, q) {
  var ctx = this;
  var self = q;
  var d = q.domain;
  this.completed = false;
  this.fn = function fn (done) {

    function terminate (err) {
      var e = err ? err : null;
      clearInterval(this.timer);
      if (!this.terminated) {
        this.task.completed = true;
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

    // expose task context in fork
    f.task = ctx;

    // access fork object from context
    ctx.fn.fork = f;

    // store start time of fork
    f.startTime = Date.now();

    // access queue from fork
    f.queue = self;

    // attach work params to fork
    f.work = w;
    
    // set killTimeout of fork
    f.killTimeout = w.killTimeout || DEFAULT_TIMEOUT;

    f.pollFrequency = w.pollFrequency || DEFAULT_POLLING_FREQUENCY;

    // store callback
    f.cb = done;

    // store events from queue
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

    // expose id in task context
    ctx.id = f.id;

    f.terminated = false;
    
    // add to forks hash
    self.forksHash[f.id] = f;
    
    // create empty array to hold errors for this fork
    self.errors[f.id] = [];

    // add to forks array
    self.forks.push(f);

  };
}

module.exports = Task;