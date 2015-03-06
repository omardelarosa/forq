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
Before running, you may also set an optional callback to fire when the queue has been drained:

```javascript
pool.queue.drain = function() {
  console.log("All done!");
};
pool.run();
```

##Events
Communication with each fork can be done through events, as would any child process.

###Binding
These events can be bound on the ``events`` key on pool initialization.

```javascript
var pool = new Forq({
  workers: workers,
  drain: function () {
   // stuff to do when worker pool finishes all tasks
  },
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
```
// initialize the worker pool
var pool = new Forq({
  workers: workers,
  drain: function () {
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