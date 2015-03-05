var Forq = require('../index');
var workers = [];
var expect = require('chai').expect;
var batch;

describe('forking and queueing process', function(){

  this.timeout(10000);

  before(function(){
    // make workers
    for (var i = 0; i < 10; i ++ ) {
      workers.push({
        path: './test/printer',
        args: [ '-f', i ],
        description: 'task #'+i
      });
    }

    // initialize new batch
    batch = new Forq({
      workers: workers
    });

  });

  it('finishes all tasks in batch', function (done){

    batch.queue.drain = function() {
      expect(batch.forks.filter(function(f){ return !f.hasFinished; }), 'unfinished tasks array').to.have.length(0);
      done();
    };
    batch.run();

  });

  it('running the batch again clears prior forks', function (done) {
    batch.queue.drain = function() {
      expect(batch.forks.length, 'number of forks').to.eq(10);
      done();
    };
    batch.run();
  });

});