var debug = require('debug')('errorer');
var counter = parseInt(process.argv.pop());
var ChildProcessSoftError = require('../errors').ChildProcessSoftError;

debug('starting slow worker');
setTimeout(function(){
  // waiting for 2 minutes
  debug('this should never print');
}, 60 * 1000 * 2);