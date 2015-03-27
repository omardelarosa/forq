var async = require('async');
var fork = require('child_process').fork;
var _ = require('lodash');
var debug = require('debug')('forq');
var d = require('domain').create();
var os = require('os');
var util = require('util');
var Task = require('./task');
var Errors = require('./errors');
var EventEmitter = require('events').EventEmitter;
var DEFAULT_CONCURRENCY = 3;
var NUM_CPUS = os.cpus().length;
var DEFAULT_WORKER_OPTIONS = {
  stdio: [0, 0, 'pipe' ]
};
var DEFAULT_TIMEOUT = 60000;
var DEFAULT_POLLING_FREQUENCY = 1000;

// initialization
function Forq (opts) {
  if (!opts) { opts = {}; }
  var self = this;

  this.opts = opts;
  this.concurrencyLimit = this.opts.concurrency || DEFAULT_CONCURRENCY;
  this.domain = d;
  this.killTimeout = opts.killTimeout || DEFAULT_TIMEOUT;
  this.pollFrequency = opts.pollFrequency || DEFAULT_POLLING_FREQUENCY;
  this.setMaxListeners(Infinity);
  this.noLimits = opts.noLimits || false;
  d.setMaxListeners(Infinity);
  // cap concurrency at the number of CPUS
  if (!this.noLimits && this.concurrencyLimit > NUM_CPUS) {
    debug('warning: concurrency will be limited at the number of CPU cores of '+NUM_CPUS);
    this.concurrencyLimit = NUM_CPUS;
  }
  this.startTime = Date.now();
  this.todo = this.opts.todo|| [];
  this.events = opts.events || {};
  this.oninit = opts.oninit ? opts.oninit.bind(this) : function () { return this; };
  var q = async.queue(function(task, done){
    task.action(done);
  }, this.concurrencyLimit); // make queue;
  this.__queue = q; // attach async queue to forq queue
  this.errors = {};
  this.forksHash = {};
  this.forks = [];
  this.data = {};
  this.tasks = [];
  // start queue timer
  this.__setQueueTimer();
  this.__queue.drain = (function(res) {
    debug("finished all tasks and calling drain");
    if (this.opts.drain && this.opts.drain.constructor === Function) {
      this.opts.drain.call(this, queue);
    }
  }).bind(this);

  this.__onfinish = (function(res) {
    debug('finished closing all active forks in queue');
    if (this.opts.onfinished && this.opts.onfinished.constructor === Function) {
      this.opts.onfinished.call(this, res);
    }
  }).bind(this);

  this.on('finished', this.__onfinish);

}

// inherit from EventEmitter
util.inherits(Forq, EventEmitter);

Forq.prototype.__setQueueTimer = function () {
  var self = this;
  this.timer = setInterval(function(){
    var currentTime = Date.now();
    debug('total tasks in queue', self.tasks.length);
    debug('total forks in queue', self.forks.length);
    debug('total pending task', self.getNumberOfPendingTasks() );
    debug('queue queue idle? ', self.__queue.idle() );
    debug('currently active forks in queue', self.getNumberOfActiveForks() );
    if (self.__queue.idle() && self.getNumberOfPendingTasks() === 0 && self.getNumberOfActiveForks() === 0) {
      clearInterval(self.timer);
      self.emit('finished', { status: 'completed' });
    } else if (currentTime - self.startTime > self.killTimeout) {
      clearInterval(self.timer);
      self.killAll();
      self.emit('finished', { status: 'aborted' });
    } else {
      debug('queue is waiting for forks to terminate');
    }
  }, self.pollFrequency);
};

Forq.prototype.getNumberOfActiveForks = function() {
  if ( this.forks && this.forks.length > 0 ) {
    return this.forks.filter(function(f){ return !f.terminated; }).length;
  } else {
    return 0;
  }
};

Forq.prototype.getNumberOfPendingTasks = function() {
  // note: if a task doesn't yet have a fork, it's queued but hasn't been started.  thus it's pending
  return this.tasks.filter(function(t){ return t.fn.fork ? t.fn.fork.connected : true; }).length;
};

// iterates through todo array and generates a task for each item in it
Forq.prototype.run = function () {
  var self = this;
  this.killAll(); // kill any existing forks

  // store domain errors
  d.on('error', function (er) {
    if ( er.domainEmitter && self.errors[er.domainEmitter.id] ) {
      self.errors[er.domainEmitter.id].push(er);
      self.emit('error', er, er.domainEmitter);
    }
  });

  this.todo.forEach(function(w){
    var t = new Task(w, self);
    self.addTask(t);
  });

  this.oninit();
  this.hasRun = true;
  return this;
};

Forq.prototype.addTask = function(t, cb) {
  this.tasks.push(t);
  this.__queue.push({
    action: t.fn.bind(this)
  }, function(err){
    // log errors processing forks
    debug("completed task", t.id);
    if (err) {
      // TODO: listen and broadcast for these errors in a stable way
      debug('task '+t.id+'finished with error'+err.toString());
    }
    // call the callback of there is one
    if (cb && cb.constructor === Function) {
      cb.call(t, err);
    }
  });
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