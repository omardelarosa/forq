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

    var tasks = [];
    var errorCounter = 0;
    
    before(function(){
      // make tasks
      for (var i = 0; i < 10; i ++ ) {
        tasks.push({
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
      var queue = new Forq({
      todo: tasks,
      concurrency: 10,
      onfinished: function () {
          var errors = _.filter(queue.errors, function(err) { return err.length > 0; });
          try {
            expect(errors.length, 'number of forks with errors').to.eq(2);
            done();
          } catch (e) { done(e); }
        }
      });
      queue.run();
    });

    it('raises SoftError and ForkError types', function(done){
      
      var queueErrors = [];

      var queue = new Forq({
        todo: tasks,
        concurrency: 10,
        onfinished: function () {
          var errors = _.filter(queue.errors, function(err) { return err.length > 0; });
          try {
            expect(errors.length, 'number of forks with errors').to.eq(2);
            expect(queueErrors.filter(function(e){ return e.constructor === SoftError; }), 'SoftErrors').to.have.length(1);
            expect(queueErrors.filter(function(e){ return e.constructor === ForkError; }), 'ForkErrors').to.have.length(1);
            done();
          } catch (e) { done(e); }
        },
        events: {
          softError: function() {
            debug("soft error occurred");
          }
        }
      });

      queue.run();
      
      queue.on('error', function(err){
        queueErrors.push(err);
      });
    
    });

  });

  describe('error namespacing', function(){
    var tasks = [];

    before(function(){
      // make tasks
      tasks.push({
        path: './test/errorer',
        args: [ '-f', 5 ],
        id: 'important_error_prone_task',
        description: 'task #1',
        opts: {
          // silence errors from log
          silent: true
        }
      });

      tasks.push({
        path: './test/errorer',
        args: [ '-f', 5 ],
        id: 'unimportant_error_prone_worker',
        description: 'task #2',
        opts: {
          // silence errors from log
          silent: true
        }
      });

      tasks.push({
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

      var queue = new Forq({
        todo: tasks,
        concurrency: 10
      });

      queue.run();

      queue.on('taskError:important_error_prone_task', function(err){
        try {
          expect(err, 'an important error').to.be.an.instanceOf(ForkError);
          done();
        } catch (e) { done(e); }
      });

    });

  });

  describe('kill timeout for tasks', function() {

    var tasks = [];
    var killTimeout = 5000;
    var bufferTime = 1500;
    this.timeout(30000);

    before(function(){
      // make tasks

      tasks.push({
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

      var queue = new Forq({
        todo: tasks,
        concurrency: 10,
        killTimeout: 10000,
        events: {
          "terminated": function () {
            end = Date.now();
            try {
              expect(end-start).to.be.lt(killTimeout+bufferTime);
              done();
            } catch (e) { done(e); }
          }
        }
      });

      queue.run();

    });

  });

  describe('kills timeout for queues', function() {

    var tasks = [];
    var killTimeout = 5000;
    var bufferTime = 1500;
    this.timeout(30000);

    before(function(){
      // make tasks

      tasks.push({
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

    it("should terminate queues once they exceed their queue timeout", function(done) {
      var start = Date.now();
      var end;

      var queue = new Forq({
        todo: tasks,
        concurrency: 10,
        onfinished: function () {
          end = Date.now();
          try {
            expect(end-start).to.be.lt(killTimeout+bufferTime);
            done();
          } catch (e) { done(e); }
        },
        killTimeout: killTimeout
      });

      queue.run();

    });

  });

});