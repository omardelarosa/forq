/* jshint loopfunc: true */

var async = require('async');
var fork = require('child_process').fork;
var _ = require('lodash');
var DEFAULT_CONCURRENCY = 3;
var BATCH_TIMEOUT = 2000;

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
        customEvents[eventName].call(f, msg.data);
      }
    });
  }

  // add default events
  f.addListener('exit', function(){
    if (f.connected) {
      // signal termination via pseudo-event
      f.send({ event: 'finished', data: {} });
    } else {
      // terminate
      f.terminate();
    }
  });

  f.addListener('disconnect', function(){
    // terminate
    f.terminate();
  });

  f.addListener('message', function(){
    var msg = arguments[0];
    if (msg.event && msg.event === 'finished') {
      console.log("finished");
      f.terminate();
    }
  });

  return f;
}

// initialization
function Forq (opts) {
  if (!opts) { opts = {}; }
  var self = this;
  this.opts = opts;
  this.concurrencyLimit = this.opts.concurrency || DEFAULT_CONCURRENCY;
  this.workers = this.opts.workers || [];
  this.events = opts.events || {};

  // attach queue;
  var q = async.queue(function(task, done){
    task.action(done);
  }, this.concurrencyLimit);
  this.queue = q;

  this.forks = [];
  this.data = {};
  this.queue.drain = this.opts.drain ? this.opts.drain.bind(self, self) : (function() {
    console.log("finished all tasks!");
  }).bind(self, self);

}

Forq.prototype.run = function () {
  var self = this;
  this.clear(); // clear any existing forks

  function startFork(worker) {
    var w = worker;
    var ctx = this;
    return function(done) {
      var f = fork(w.path, w.args);
      var fork_id = Date.now().toString('16');
      this.fork_id = fork_id;
      this.f = f;
      f.cb = done;
      f.events = self.events || {};
      f.worker = w;
      f.pool = self;

      this.f.terminate = function () {
        if (!f.terminated) {
          f.terminated = true;
          if (f.cb) { f.cb(); }
        }
      };

      // assign event handlers
      __attachEventListeners.apply(f);

      f.id = fork_id;
      f.hasFinished = false;
      
      self.forks.push(f);
    };
  }

  this.workers.forEach(function(w){
    self.queue.push({
      action: startFork(w)
    }, function(err){
      if (err) { console.log("Error:", err); }

    });
  });

  return this;
};

Forq.prototype.clear = function () {
  if (this.forks) {
    this.forks = [];
  }
};

module.exports = Forq;