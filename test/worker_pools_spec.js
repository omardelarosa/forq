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
    var pool;

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

    it('finishes all tasks using worker pool', function (done){
      // initialize new pool
      pool = new Forq({
        workers: workers,
        onfinished: function() {
          expect(this.forks.filter(function(f){ return !f.terminated; }), 'unfinished tasks array').to.have.length(0);
          done();
        }
      });

      pool.run();

    });

    it('running the pool again clears prior forks', function (done) {

      // redefine drain function from what was initialized
      pool.queue.drain = function() {
        try {
          expect(pool.forks.length, 'number of forks').to.eq(10);
          done();
        } catch (e) { done(e); } 
      };

      pool.run();

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

    it('fires events that are defined in the worker pool options', function(done){
      // initialize new pool
      var pool = new Forq({
        workers: workers,
        onfinished: function () {
          expect(pool.forks.length, 'number of forks').to.eq(10);
          done();
        },
        events: {
          myCustomEvent: function(){
            debug("custom event has fired", arguments);
          }
        }
      });
      pool.run();

    });

    it('can use the pool to share data between forks', function (done){
      
      var pool = new Forq({
        workers: workers,
        onfinished: function () {
          debug("pool status", this.__data.statuses);
          try {
            expect(this.__data.tempCounter, 'pool temp counter').to.eq(1000);
            expect(this.__data.statuses, 'pool status list').to.have.length(10);
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
            this.pool.__data.tempCounter += data.temp;
            this.pool.__data.statuses.push(_.sample(statuses));
          }
        }
      });

      pool.run();
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

      var pool = new Forq({
        workers: workers,
        concurrency: (NUM_CPUS*2),
        onfinished: function () {
          expect(pool.concurrencyLimit, 'concurrency limit').to.eq(NUM_CPUS);
          done();
        }
      });

      pool.run();

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

      var pool = new Forq({
        workers: tasks,
        concurrency: 10,
        onfinished: function () {
          // waiting to add another task
          setTimeout(function(){
            // adding another task
            pool.addTask(new Task({
              path: './test/printer',
              args: [ '-f', 10 ],
              description: 'task #10'
            }, pool ));
            // waiting to call done
            setTimeout(function(){
              // calling done
              done();
            }, 1000);
          }, 1000);
        }
      });

      pool.run();

    });

    it('new tasks accept callbacks', function (done) {

      function taskCompleteCallback (err){
        debug('finished task', this.id);
        done();
      }

      var pool = new Forq({
        workers: tasks,
        concurrency: 10,
        onfinished: function () {
          // waiting to add another task
          setTimeout(function(){
            // adding another task
            pool.addTask(new Task({
              path: './test/printer',
              args: [ '-f', 10 ],
              description: 'task #10'
            }, pool ), taskCompleteCallback);
          }, 1000);
        }
      });

      pool.run();

    });

  });

});