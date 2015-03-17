var debug = require('debug')('errorer');
var counter = parseInt(process.argv.pop());
var ChildProcessSoftError = require('../errors').ChildProcessSoftError;

debug('starting errorer #'+counter);
setTimeout(function(){
  // waiting
  debug('counter: '+counter);
  if (counter === 5) {
    throw new Error('woops 1!');
  }
  debug('finished timeout in errorer #'+counter);
}, 1000);
debug('done with errorer #'+counter+', but not timeout');