var debug = require('debug')('printer');

setTimeout(function(){
  // waiting
  debug('waiting...');
}, 500);

// fire a custom event
process.send({ event: 'myCustomEvent', data: { status: 'well', temp: 100 }});