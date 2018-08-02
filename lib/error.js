module.exports = class extends Error {
  constructor(error, statusCode) {
    if (error instanceof Error) {
      super(error.message);
      [
        'statusCode',
        'message',
        'error',
        'options',
        'response',
        'request'
      ]
        .forEach((prop) => {
          if (error[prop]) {
            this[prop] = error[prop];
          }
        });
    }
    else {
      super(error);
    }

    if (statusCode) {
      this.statusCode = statusCode;
    }

    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
};
