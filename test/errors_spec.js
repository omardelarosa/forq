var Forq = require('../index');
var expect = require('chai').expect;
var firedEvents = {};
var debug = require('debug');
var _ = require('lodash');

var SoftError = Forq.Errors.SoftError;
var ForkError = Forq.Errors.ForkError;

describe('Error Handling', function(){

  this.timeout(10000);

  describe('basic errors', function (){

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
      onfinished: function () {
          var errors = _.filter(pool.errors, function(err) { return err.length > 0; });
          expect(errors.length, 'number of forks with errors').to.eq(2);
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
        onfinished: function () {
          var errors = _.filter(pool.errors, function(err) { return err.length > 0; });
          expect(errors.length, 'number of forks with errors').to.eq(2);
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

      var pool = new Forq({
        workers: workers,
        concurrency: 10
      });

      pool.run();

      pool.on('workerError:important_error_prone_worker', function(err){
        expect(err, 'an important error').to.be.an.instanceOf(ForkError);
        done();
      });

    });

  });

  describe('kill timeout for workers', function() {

    var workers = [];
    var killTimeout = 5000;
    var bufferTime = 300;
    this.timeout(30000);

    before(function(){
      // make workers

      workers.push({
        path: './test/slow_worker',
        args: [ '-f', 1 ],
        id: 'slow_worker',
        description: 'task #1',
        opts: {
          // silence errors from log
          silent: true
        },
        killTimeout: killTimeout
      });

    });

    it("should terminate forks once they exceed their worker timeout", function(done) {
      var start = Date.now();
      var end;

      var pool = new Forq({
        workers: workers,
        concurrency: 10,
        killTimeout: 10000,
        events: {
          "terminated": function () {
            end = Date.now();
            expect(end-start).to.be.lt(killTimeout+bufferTime);
            done();
          }
        }
      });

      pool.run();

    });

  });

  describe('kills timeout for pools', function() {

    var workers = [];
    var killTimeout = 5000;
    var bufferTime = 300;
    this.timeout(30000);

    before(function(){
      // make workers

      workers.push({
        path: './test/slow_worker',
        args: [ '-f', 1 ],
        id: 'slow_worker',
        description: 'task #1',
        opts: {
          // silence errors from log
          silent: true
        }
      });

    });

    it("should terminate pools once they exceed their pool timeout", function(done) {
      var start = Date.now();
      var end;

      var pool = new Forq({
        workers: workers,
        concurrency: 10,
        onfinished: function () {
          end = Date.now();
          expect(end-start).to.be.lt(killTimeout+bufferTime);
          done();
        },
        killTimeout: killTimeout
      });

      pool.run();

    });

  });

});