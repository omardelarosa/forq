var debug = require('debug')('errorer');
var counter = parseInt(process.argv.pop());
var ChildProcessSoftError = require('../errors').ChildProcessSoftError;

setTimeout(function(){
  // waiting
  debug('counter: '+counter);
  if (counter === 5) {
    throw new Error('woops 1!');
  }
}, 500);