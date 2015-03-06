var Forq = require('../index');
var expect = require('chai').expect;
var firedEvents = {};

describe('forking and queueing process', function(){

  this.timeout(10000);

  describe('worker pool processing', function(){

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

  describe('event binding', function(){

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

    it('fires events that are defined in the worker pool options', function(){
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

  });

});