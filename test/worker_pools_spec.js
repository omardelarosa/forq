var Forq = require('../index');
var expect = require('chai').expect;
var firedEvents = {};
var debug = require('debug');
var _ = require('lodash');
var Task = require('../task');
var SoftError = Forq.Errors.SoftError;
var ForkError = Forq.Errors.ForkError;

describe('Forq Worker Pools', function(){

  this.timeout(10000);

  describe('queueing', function(){

    var workers = [];
    var queue;

    before(function(){
      // make workers
      for (var i = 0; i < 10; i ++ ) {
        workers.push({
          path: './test/printer',
          args: [ '-f', i ],
          description: 'task #'+i
        });
      }

    });

    it('finishes all tasks using worker queue', function (done){
      // initialize new queue
      queue = new Forq({
        workers: workers,
        onfinished: function() {
          try {
            expect(this.forks.filter(function(f){ return !f.terminated; }), 'unfinished tasks array').to.have.length(0);
            done();
          } catch (e) { done(e); }
        }
      });

      queue.run();

    });

    it('running the queue again clears prior forks', function (done) {

      // redefine drain function from what was initialized
      queue.__queue.drain = function() {
        try {
          expect(queue.forks.length, 'number of forks').to.eq(10);
          done();
        } catch (e) { done(e); } 
      };

      queue.run();

    });

  });

  describe('events', function(){

    var workers = [];

    before(function(){
      // make workers
      for (var i = 0; i < 10; i ++ ) {
        workers.push({
          path: './test/printer',
          args: [ '-f', i ],
          description: 'task #'+i
        });
      }

    });

    it('fires events that are defined in the worker queue options', function(done){
      // initialize new queue
      var queue = new Forq({
        workers: workers,
        onfinished: function () {
          try {
            expect(queue.forks.length, 'number of forks').to.eq(10);
            done();
          } catch (e) { done(e); }
        },
        events: {
          myCustomEvent: function(){
            debug("custom event has fired", arguments);
          }
        }
      });
      queue.run();

    });

    it('can use the queue to share data between forks', function (done){
      
      var queue = new Forq({
        workers: workers,
        onfinished: function () {
          debug("queue status", this.__data.statuses);
          try {
            expect(this.__data.tempCounter, 'queue temp counter').to.eq(1000);
            expect(this.__data.statuses, 'queue status list').to.have.length(10);
            done();
          } catch (e) {
            done(e);
          }
        },
        oninit: function() {
          this.__data = {};
          this.__data.tempCounter = 0;
          this.__data.statuses = [];
        },
        events: {
          myCustomEvent: function(data){
            debug("custom event has fired", data, this);
            var statuses = [ 'fine', 'cool', 'hungry', 'bored'];
            this.queue.__data.tempCounter += data.temp;
            this.queue.__data.statuses.push(_.sample(statuses));
          }
        }
      });

      queue.run();
    });

  });

  describe('concurrency', function(){

    var workers = [];
    var NUM_CPUS;

    before(function(){
      // make workers
      NUM_CPUS = require('os').cpus().length;

      for (var i = 0; i < (NUM_CPUS*2); i ++ ) {
        workers.push({
          path: './test/printer',
          args: [ '-f', i ],
          description: 'task #'+i
        });
      }

    });

    it('limits the concurrency at the number of cpu cores', function(done){

      var queue = new Forq({
        workers: workers,
        concurrency: (NUM_CPUS*2),
        onfinished: function () {
          try {
            expect(queue.concurrencyLimit, 'concurrency limit').to.eq(NUM_CPUS);
            done();
          } catch (e) { done(e); }
        }
      });

      queue.run();

    });

    it('ignores concurrency limits when in "noLimits" mode', function(done){

      var queue = new Forq({
        workers: workers,
        concurrency: 20,
        noLimits: true,
        onfinished: function () {
          try {
            expect(queue.concurrencyLimit, 'concurrency limit').to.eq(20);
            done();
          } catch (e) { done(e); }
        }
      });

      queue.run();

    });

  });

  describe('adding tasks', function(){

    var tasks = [];

    before(function(){
      // make tasks

      for (var i = 0; i < 10; i ++ ) {
        tasks.push({
          path: './test/printer',
          args: [ '-f', i ],
          description: 'task #'+i
        });
      }

    });

    it('allows tasks to be added to the queue in progress', function (done) {

      var queue = new Forq({
        workers: tasks,
        concurrency: 10,
        onfinished: function () {
          // waiting to add another task
          setTimeout(function(){
            // adding another task
            queue.addTask(new Task({
              path: './test/printer',
              args: [ '-f', 10 ],
              description: 'task #10'
            }, queue ));
            // waiting to call done
            setTimeout(function(){
              // calling done
              done();
            }, 1000);
          }, 1000);
        }
      });

      queue.run();

    });

    it('new tasks accept callbacks', function (done) {

      function taskCompleteCallback (err){
        debug('finished task', this.id);
        done();
      }

      var queue = new Forq({
        workers: tasks,
        concurrency: 10,
        onfinished: function () {
          // waiting to add another task
          setTimeout(function(){
            // adding another task
            queue.addTask(new Task({
              path: './test/printer',
              args: [ '-f', 10 ],
              description: 'task #10'
            }, queue ), taskCompleteCallback);
          }, 1000);
        }
      });

      queue.run();

    });

  });

});