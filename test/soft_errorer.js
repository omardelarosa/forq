var debug = require('debug')('soft_errorer');
var ChildProcessSoftError = require('../errors').ChildProcessSoftError;

setTimeout(function(){
  // waiting
  debug('about to throw soft error');
  try {
    throw new Error('soft error');
  } catch (e) {
    new ChildProcessSoftError(e);
  }
}, 500);