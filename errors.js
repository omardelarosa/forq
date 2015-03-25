function ForkError(e, extra) {
  Error.call(this);
  Error.captureStackTrace(this, ForkError);
  this.id = e.id;
  this.name = 'ForkError';
  this.message = e.message;
}

ForkError.prototype.toObject = function () {
  return {
    name: this.name,
    message: this.message,
    stack: {}
  };
};

function ChildProcessSoftError (e, extra) {
  this.message = e.message;
  this.name = e.name;
  this.stack = e.stack;
  this.error = e;
  process.send({
    event: 'softError',
    data: {
      message: this.message,
      name: this.name,
      stack: this.stack
    }
  });
}

function SoftError(e, extra) {
  Error.call(this);
  this.id = e.id;
  this.name = 'SoftError';
  this.message = e.message;
  this.stack = e.stack;
}

module.exports = {
  ForkError: ForkError,
  SoftError: SoftError,
  ChildProcessSoftError: ChildProcessSoftError
};