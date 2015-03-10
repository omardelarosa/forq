var Forq = require('../index');
var expect = require('chai').expect;
var firedEvents = {};
var debug = require('debug');
var _ = require('lodash');

var SoftError = Forq.Errors.SoftError;
var ForkError = Forq.Errors.ForkError;

describe('worker pool queue', function(){

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
        drain: function() {
          expect(pool.forks.filter(function(f){ return !f.terminated; }), 'unfinished tasks array').to.have.length(0);
          done();
        }
      });

      pool.run();

    });

    it('running the pool again clears prior forks', function (done) {

      // redefine drain function from what was initialized
      pool.queue.drain = function() {
        expect(pool.forks.length, 'number of forks').to.eq(10);
        done();
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
        drain: function () {
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
        drain: function () {
          debug("pool status", this.__data.statuses);
          expect(this.__data.tempCounter, 'pool temp counter').to.eq(1000);
          expect(this.__data.statuses, 'pool status list').to.have.length(10);
          done();
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
        drain: function () {
          expect(pool.concurrencyLimit, 'concurrency limit').to.eq(NUM_CPUS);
          done();
        }
      });

      pool.run();

    });

  });

  describe('error handling', function (){

    var workers = [];
    var errorCounter = 0;
    
    before(function(){
      // make workers
      for (var i = 0; i < 10; i ++ ) {
        workers.push({
          path: i == 7 ? './test/soft_errorer' : './test/errorer',
          args: [ '-f', i ],
          description: 'task #'+i,
          opts: {
            // silence errors from log
            silent: true
          }
        });
      }

    });

    it('catches errors that occur in forks', function(done){
      var pool = new Forq({
      workers: workers,
      concurrency: 10,
      drain: function () {
          var errors = _.filter(pool.errors, function(err) { return err.length > 0; });
          expect(errors.length, 'number of forks with errors').to.eq(1);
          done();
        }
      });
      pool.run();
    });

    it('raises SoftError and ForkError types', function(done){
      
      var poolErrors = [];

      var pool = new Forq({
        workers: workers,
        concurrency: 10,
        drain: function () {
          var errors = _.filter(pool.errors, function(err) { return err.length > 0; });
          expect(errors.length, 'number of forks with errors').to.eq(1);
          expect(poolErrors.filter(function(e){ return e.constructor === SoftError; }), 'SoftErrors').to.have.length(1);
          expect(poolErrors.filter(function(e){ return e.constructor === ForkError; }), 'ForkErrors').to.have.length(1);
          done();
        },
        events: {
          softError: function() {
            debug("soft error occurred");
          }
        }
      });

      pool.run();
      
      pool.on('error', function(err){
        poolErrors.push(err);
      });
    
    });

  });

  describe('error namespacing', function(){
    var workers = [];

    before(function(){
      // make workers
      workers.push({
        path: './test/errorer',
        args: [ '-f', 5 ],
        id: 'important_error_prone_worker',
        description: 'task #1',
        opts: {
          // silence errors from log
          silent: true
        }
      });

      workers.push({
        path: './test/errorer',
        args: [ '-f', 5 ],
        id: 'unimportant_error_prone_worker',
        description: 'task #2',
        opts: {
          // silence errors from log
          silent: true
        }
      });

      workers.push({
        path: './test/printer',
        args: [ '-f', 3 ],
        id: 'normal_worker',
        description: 'task #3',
        opts: {
          // silence errors from log
          silent: true
        }
      });

    });

    it('emits errors using a namespace', function(done){
      var importantError;
      var pool = new Forq({
        workers: workers,
        concurrency: 10,
        drain: function () {
          expect(importantError, 'an important error').to.be.an.instanceOf(ForkError);
          done();
        }
      });

      pool.run();

      pool.on('workerError:important_error_prone_worker', function(err){
        importantError = err;
      });

    });

  });

});