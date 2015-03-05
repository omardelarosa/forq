# Forq
Manage forked processes using [Node](http://nodejs.org/) and [Async.js](https://github.com/caolan/async)

[![build status](https://travis-ci.org/omardelarosa/forq.png?branch=master)](https://travis-ci.org/omardelarosa/forq?branch=master)

## Installation
```bash
npm install forq
```

## Usage
Require the 'forq' module at the top of your file:

```javascript
var Forq = require('forq');
```

###Worker
Set up a node module to be your worker For example, './slow_printer' is a node module that would console log after 500ms and look like this:

```javascript
// slow_printer.js

setTimeout(function(){
  console.log('printing slowly');
}, 500)
```

###Batch
Setup a batch of workers that reference one or more node module:

```javascript
// make workers
for (var i = 0; i < 10; i ++ ) {
  workers.push({
    path: './slow_printer',
    // you can specify arguments as an array here
    args: [ '-f', i ],
    description: 'task #'+i
  });
}
```

###Initialization
Initialize your new batch with the workers

```javascript
// initialize new batch
var batch = new Forq({
  workers: workers,
  // set your desired concurrency
  concurrency: 4
});
```

###Running
Run all the tasks in your batch:

```javascript
batch.run();
```

###Callbacks
Before running, you may also set an optional callback to fire when the queue has been drained:

```javascript
batch.queue.drain = function() {
  console.log("All done!");
};
batch.run();
```