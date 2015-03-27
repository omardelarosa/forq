var Forq = require('../index');
var expect = require('chai').expect;
var firedEvents = {};
var debug = require('debug');
var _ = require('lodash');

var SoftError = Forq.Errors.SoftError;
var ForkError = Forq.Errors.ForkError;

describe('Timeouts', function(){

  this.timeout(10000);

  describe('kill timeout for workers', function() {

    var workers = [];
    var killTimeout = 5000;
    var bufferTime = 1500;
    this.timeout(60000);

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
            try {
              expect(end-start).to.be.lt(killTimeout+bufferTime);
              done();
            } catch (e) { done(e); }
           }
        }
      });

      pool.run();

    });

  });

  describe('kills timeout for pools', function() {

    var workers = [];
    var killTimeout = 5000;
    var bufferTime = 1500;
    this.timeout(60000);

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
          try {
            expect(end-start).to.be.lt(killTimeout+bufferTime);
            done();
          } catch (e) { done(e); }
        },
        killTimeout: killTimeout
      });

      pool.run();

    });

  });

});