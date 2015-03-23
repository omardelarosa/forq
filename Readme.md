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
Setup an array of workers that reference one or more node module:

```javascript
// make workers
var workers = [];

workers.push({
  path: './slow_printer',
  // you can specify arguments as an array here
  args: [ '-f', 'yo' ],
  description: 'task #1'
});

workers.push({
  path: './fast_printer',
  // you can specify arguments as an array here
  args: [ '-f', 'blah'],
  description: 'task #2'
});

```

###Initialization
Initialize your new worker pool with the array of workers

```javascript
// initialize new pool
var pool = new Forq({
  workers: workers,
  // set your desired concurrency
  concurrency: 4
});
```

###Running
Run all the workers in the array passed into your worker pool:

```javascript
pool.run();
```

###Tasks
After a worker pool has been initialized, additional work can be added as a ``Task``.  To use a task, first require the ``Task`` constructor:

```javascript
var Task = require('fork/task');
```
Then just use the ``.addTask`` method to add it to the worker pool

```javascript
var pool = new Forq({
  workers: tasks,
  concurrency: 10,
  onfinished: function () {
    
    // waiting to add another task
    setTimeout(function(){
    
      // adding another task
      pool.addTask(new Task({
        path: './test/printer',
        args: [ '-f', 10 ],
        description: 'task #10'
      }, pool ));
    
    }, 1000);
  
  }
});

pool.run();
```

Tasks also accept callbacks:

```javascript
var pool = new Forq({
  workers: tasks,
  concurrency: 10,
  onfinished: function () {
    
    // waiting to add another task
    setTimeout(function(){
    
      // adding another task
      pool.addTask(new Task({
        path: './test/printer',
        args: [ '-f', 10 ],
        description: 'task #10'
      }, pool, 

      // this is a callback that fires when the task has been processed
      function (err) {
        // insert your callback logic here
      }));
    
    }, 1000);
  
  }
});

pool.run();
```

###Callbacks
You may also set an optional callback to fire when the pool has been notified that all worker forks have terminated:

```javascript
// initialize new pool
var pool = new Forq({
  workers: workers,
  // set your desired concurrency
  concurrency: 4,
  // optional callback
  onfinished: function() {
    console.log("Queue is drained!");
  };
});
```
This call back fires when all forks have terminated.

##Events
Communication with each fork can be done through events.

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

###Default Events
By default, workers and pools emit a variety of events:

####Pool Events
 Event Name  | Parameters Sent to Handler |  Notes
-----------  | -------------------------- | --------
``finished`` |  -> ( { status:  '...' } ) | possible statuses: 'completed', 'aborted'
``error``    |  -> ( err )                | see the errors.js module for different error types
``workerError``| -> (err)                 | when any worker fires an error
``workerError:{idOfWorker}`` | -> (err) | when an specific worker with specified id fires an error

####Worker Events
 Event Name  | Parameters Sent to Handler |  Notes
-----------  | -------------------------- | --------
``finished`` |  -> ( {} )                 | empty object
``error``    |  -> ( err )                | see the errors.js module for different error types


###Custom Events
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

##Errors
###Fork-Halting Errors
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


``.errors``

Each worker pool has an array of arrays called ``.errors`` containing errors raised by their respective worker's forks.

``Forq.Errors``

The Forq module includes a few Error constructors that can be used for 

##Timeouts

Both workers and worker pools can have timeouts set ``killTimeout`` attribute upon their initialization.  There is also a ``pollFrequency`` value which can be used to adjust how often the main process checks for timeouts

###Pool Timeout
```javascript
var pool = new Forq({
  workers: workers,
  concurrency: 10,
  // set a 10 second timeout for the pool
  killTimeout: 10000,
  // poll frequency of 1 second
  pollFrequency: 1000
});
```
###Worker Timeout
```javascript
var workers = []
workers.push({
  path: './test/slow_worker',
  args: [ ],
  id: 'slow_worker',
  // a 10 second timeout on the worker
  killTimeout: 10000,
    // poll frequency of 1 second
  pollFrequency: 1000
});
```

#Changelog

##0.0.2
- Now using native Node Domain for worker pool management
- Improved Error handling
- Added Worker Error namespacing support

##0.0.3
- Added monitoring for active forks and handling for stale/hanging forks.
- Added killTimeout options for pools and forks
- Added 'onfinished' option to use in place of queue.drain

##0.0.4
- Readme updates and minor improvements to index.js