var Forq = require('../index');
var expect = require('chai').expect;
var firedEvents = {};
var debug = require('debug');
var _ = require('lodash');

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
          debug("pool status", pool.__data.statuses);
          expect(pool.__data.tempCounter, 'pool temp counter').to.eq(1000);
          expect(pool.__data.statuses, 'pool status list').to.have.length(10);
          done();
        },
        events: {
          myCustomEvent: function(data){
            debug("custom event has fired", data);
            var statuses = [ 'fine', 'cool', 'hungry', 'bored'];
            pool.__data.tempCounter += data.temp;
            pool.__data.statuses.push(_.sample(statuses));
          }
        }
      });

      pool.__data = {};
      pool.__data.tempCounter = 0;
      pool.__data.statuses = [];

      pool.run();
    });

  });

});