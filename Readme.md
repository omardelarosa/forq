# Forq

Manage process forks using a task queue

## Build Status
Branch  | Build Status | Version
------- | ------------ | ----
 master | [![build status](https://travis-ci.org/omardelarosa/forq.png?branch=master)](https://travis-ci.org/omardelarosa/forq?branch=master)  |  [![npm version](https://img.shields.io/npm/v/forq.svg)](https://img.shields.io/npm/v/forq.svg)
 development | [![build status](https://travis-ci.org/omardelarosa/forq.png?branch=development)](https://travis-ci.org/omardelarosa/forq?branch=development) | 0.0.7


## Installation
```bash
npm install forq
```

## Usage
Require the 'forq' module at the top of your file:

```javascript
var Forq = require('forq');
```

### Task
Set up a node module to be your task worker For example, './slow_printer' is a node module that would console log after 500ms and look like this:

```javascript
// slow_printer.js

setTimeout(function(){
  console.log('printing slowly');
}, 500)
```

### Queue
Setup an array of tasks that reference one or more node module:

```javascript
// make tasks
var tasks = [];

tasks.push({
  path: './slow_printer',
  // you can specify arguments as an array here
  args: [ '-f', 'yo' ],
  description: 'task #1'
});

tasks.push({
  path: './fast_printer',
  // you can specify arguments as an array here
  args: [ '-f', 'blah'],
  description: 'task #2'
});

```

### Initialization
Initialize your new fork queue with the array of tasks

```javascript
// initialize new task queue
var queue = new Forq({
  todo: tasks,
  // set your desired concurrency
  concurrency: 4
});
```

### Start processing the queue
Start all the tasks in the array passed into your fork queue using ``.run``:

```javascript
queue.run();
```

### Adding Additional Tasks
After a task queue has been initialized, additional work can be added as a ``Task``.  To use a task, first require the ``Task`` constructor:

```javascript
var Task = require('fork/task');
```
Then just use the ``.addTask`` method to add it to the queue

```javascript
var queue = new Forq({
  todo: tasks,
  onfinished: function () {
    
    // waiting to add another task
    setTimeout(function(){
    
      // adding another task
      queue.addTask(new Task({
        path: './test/printer',
        description: 'a later task'
      }, pool ));
    
    }, 1000);
  
  }
});

queue.run();
```

Tasks also accept callbacks:

```javascript
var queue = new Forq({
  todo: tasks,
  onfinished: function () {
    
    // waiting to add another task
    setTimeout(function(){
    
      // adding another task
      queue.addTask(new Task({
        path: './test/printer',
        description: 'a later task'
      }, 

      // pass in a queue as a second argument (can be a different queue)
      queue, 

      // this is a callback that fires when the task has been processed
      function (err) {
        // insert your callback logic here
      }));
    
    }, 1000);
  
  }
});

queue.run();
```

### Callbacks
You may also set an optional callback to fire when the fork queue has been notified that all task forks have terminated:

```javascript
// initialize new queue
var queue = new Forq({
  todo: tasks,
  // set your desired concurrency
  concurrency: 4,
  // optional callback
  onfinished: function() {
    console.log("Queue is drained!");
  };
});
```
This callback fires when all tasks have been completed.

## Events
Communication with each fork can be done through events.

### Binding
These events can be bound on the ``events`` key on queue initialization.

```javascript
var queue = new Forq({
  todo: tasks,
  onfinished: function () {
   // stuff to do when the task queue finishes all tasks and there are no active processes/tasks
  },
  // task events to listen for and react to
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

### Default Events
By default, tasks and queues emit a variety of events:

#### Queue Events
 Event Name  | Parameters Sent to Handler |  Notes
-----------  | -------------------------- | --------
``finished`` |  -> ( { status:  '...' } ) | possible statuses: 'completed', 'aborted'
``error``    |  -> ( err )                | see the errors.js module for different error types
``taskError``| -> (err)                 | when any task fires an error
``taskError:{idOfTask}`` | -> (err) | when an specific task with specified id fires an error

#### Task Events
 Event Name  | Parameters Sent to Handler |  Notes
-----------  | -------------------------- | --------
``finished`` |  -> ( {} )                 | empty object
``error``    |  -> ( err )                | see the errors.js module for different error types


### Custom Events
Each custom event can be fired from within a task child process by passing an object with ``data`` and ``event`` keys to the ``process.send`` method:
```javascript
// my_task_worker.js

process.send({ event: 'myCustomEvent', data: { hello: 'world', temp: 100 }});
```
Each event's ``this`` is bound to the ``Process`` instance that triggered it.  The ```data`` object is then sent to the event handler as the first argument and accessible in its scope.

## Sharing Data Among Tasks In a Queue
Tasks can share data by attaching it to the ``queue``.  For example:
```javascript
// initialize the queue
var queue = new Forq({
  todo: tasks,
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
      this.queue.__data.tempCounter += data.temp;
      this.queue.__data.statuses.push(_.sample(statuses));
    }
  }
});

// start processing the tasks in the queue
queue.run();
```

## Errors
### Fork-Halting Errors
Errors will be logged in the respective stderr of their task's fork and emit an 'error' event to the queue.   Errors can be listened for on the queue level:

```javascript
queue.on('error', function(err){
  // handle the error somehow
});
```

Or they can be listened for on the tasks themselves using the following namespace:
```javascript
var tasks = [
  {
    path: './worker_module',
    description: 'task b',
    // set the task name here
    id: 'task_a'
  },
  path: './worker_module',
    description: 'task a',
    // set the task name here
    id: 'task_b'
  }
];

var queue = new Forq({
  todo: tasks,
  concurrency: 10,
  onfinish: function () {
    // all done!
  }
});

queue.on('taskError:task_a', function(err){
  // handle the error for just task_a somehow
});
```


``.errors``

Each queue has an array of arrays called ``.errors`` containing errors raised by their respective tasks and their forks.

``Forq.Errors``

The Forq module includes a few Error constructors that can be used for 

## Timeouts

Both tasks and queues can have timeouts set ``killTimeout`` attribute upon their initialization.  There is also a ``pollFrequency`` value which can be used to adjust how often the main process checks for timeouts

### Queue Timeout
```javascript
var queue = new Forq({
  todo: tasks,
  concurrency: 10,
  // set a 10 second timeout for the pool
  killTimeout: 10000,
  // poll frequency of 1 second
  pollFrequency: 1000
});
```
### Task Timeout
```javascript
var tasks = []
tasks.push({
  path: './test/slow_worker',
  args: [ ],
  id: 'slow_task',
  // a 10 second timeout on the task
  killTimeout: 10000,
    // poll frequency of 1 second
  pollFrequency: 1000
});
```

# Changelog

## 0.0.2
- Now using native Node Domain for worker pool management
- Improved Error handling
- Added Worker Error namespacing support

## 0.0.3
- Added monitoring for active forks and handling for stale/hanging forks.
- Added killTimeout options for pools and forks
- Added 'onfinished' option to use in place of queue.drain

## 0.0.4
- Readme updates and minor improvements to index.js

## 0.0.7
- Added noLimit mode that ignores concurrency limit
- Changed 'worker' to 'tasks' and 'pool' to 'queue' throughout