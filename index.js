var async = require('async');
var fork = require('child_process').fork;

var DEFAULT_CONCURRENCY = 3;

function Forq (opts) {
  if (!opts) { opts = {}; }
  var concurrencyLimit = opts.concurrency || DEFAULT_CONCURRENCY;
  this.workers = opts.workers || [];

  var q = async.queue(function(task, done){
    task.action(done);
  }, concurrencyLimit);

  this.queue = q;
  this.forks = [];
  this.data = {};
  this.queue.drain = opts.drain || function() {
    console.log("finished all tasks!");
  };

}

Forq.prototype.run = function () {
  var self = this;
  this.clear(); // clear any existing forks

  function startFork(worker) {
    var w = worker;
    return function(done) {
      var f = fork(w.path, w.args);
      var fork_id = Date.now().toString('16');
      f.id = fork_id;
      f.hasFinished = false;
      f.on('exit', function(){
        f.hasFinished = true;
        done();
      });
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
};

Forq.prototype.clear = function () {
  this.forks = [];
};

module.exports = Forq;