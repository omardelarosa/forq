# Forq
[![build status](https://travis-ci.org/omardelarosa/forq.png?branch=master)](https://travis-ci.org/omardelarosa/forq?branch=master) [![npm version](https://img.shields.io/npm/v/forq.svg)](https://img.shields.io/npm/v/forq.svg)

Manage forked processes using [Node](http://nodejs.org/) and [Async.js](https://github.com/caolan/async)

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

###Pool
Setup a pool of workers that reference one or more node module:

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
Initialize your new pool with the workers

```javascript
// initialize new pool
var pool = new Forq({
  workers: workers,
  // set your desired concurrency
  concurrency: 4
});
```

###Running
Run all the tasks in your pool:

```javascript
pool.run();
```

###Callbacks
Before running, you may also set an optional callback to fire when the pool has drained:

```javascript
pool.queue.drain = function() {
  console.log("Queue is drained!");
};
pool.run();
```
However, note that there may still be active forks running.  To wait until all forks have finished, use the ``onfinished`` option on Forq initialization.

##Events
Communication with each fork can be done through events, as would any child process.

###Binding
These events can be bound on the ``events`` key on pool initialization.

```javascript
var pool = new Forq({
  workers: workers,
  onfinished: function () {
   // stuff to do when worker pool finishes all tasks and there are no active forks
  },
  // worker events to listen for and react to
  events: {
    exit: function(code, err) {
      // stuff to do on process exit
    },
    myCustomEvent: function(data){
      // stuff to do during custom event
    }
  }
});
```

Each custom event can be fired from within a worker child process by passing an object with ``data`` and ``event`` keys to the ``process.send`` method:
```javascript
// my_worker.js

process.send({ event: 'myCustomEvent', data: { hello: 'world', temp: 100 }});
```
Each event's ``this`` is bound to the ``Process`` instance that triggered it.  The ```data`` object is then sent to the event handler as the first argument and accessible in its scope.

##Sharing Data Among Workers In a Pool
Workers can share data by attaching it to the ``pool``.  For example:
```javascript
// initialize the worker pool
var pool = new Forq({
  workers: workers,
  onfinished: function () {
    // check updated values
    console.log(this.__data.tempCounter);
    console.log(this.__data.statuses)
  },
  oninit: function() {
    // initialize data containers
    this.__data = {};
    this.__data.tempCounter = 0;
    this.__data.statuses = [];
  },
  events: {
    myCustomEvent: function(data){
      // update the data containers or increment their values
      var statuses = [ 'fine', 'cool', 'hungry', 'bored'];
      this.pool.__data.tempCounter += data.temp;
      this.pool.__data.statuses.push(_.sample(statuses));
    }
  }
});

// start processing the tasks in the worker pool
pool.run();
```

#Errors
##Fork-Halting Errors
Errors will be logged in the respective stderr of their fork and emit an 'error' event to the worker pool.   Errors can be listened for on the pool level:

```javascript
pool.on('error', function(err){
  // handle the error somehow
});
```

Or they can be listened for on the workers themselves using the following namespace:
```javascript
var workers = [
  {
    path: './worker_module',
    description: 'worker b',
    // set the worker name here
    id: 'worker_a'
  },
  path: './worker_module',
    description: 'worker a',
    // set the worker name here
    id: 'worker_b'
  }
];

var pool = new Forq({
  workers: workers,
  concurrency: 10,
  onfinish: function () {
    // all done!
  }
});

pool.on('workerError:worker_a', function(err){
  // handle the error for just worker1 somehow
});
```

###.errors
Each worker pool has an array of arrays called ``.errors`` containing errors raised by their respective worker's forks.

###Forq.Errors
The Forq module includes a few Error constructors that can be used for 

#Changelog

##0.0.2
- Now using native Node Domain for worker pool management
- Improved Error handling
- Added Worker Error namespacing support

##0.0.3
- Added monitoring for active forks and handling for stale/hanging forks.
- Added killTimeout options for pools and forks
- Added 'onfinished' option to use in place of queue.drain