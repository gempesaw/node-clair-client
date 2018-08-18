function ClairClientError(message, fileName, lineNumber) {
  const instance = new Error(message, fileName, lineNumber);
  Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
  if (Error.captureStackTrace) {
    Error.captureStackTrace(instance, ClairClientError);
  }
  return instance;
}

ClairClientError.prototype = Object.create(Error.prototype, {
  constructor: {
    value: Error,
    enumerable: false,
    writable: true,
    configurable: true
  }
});

if (Object.setPrototypeOf) {
  Object.setPrototypeOf(ClairClientError, Error);
}
else {
  ClairClientError.__proto__ = Error; // eslint-disable-line
}

module.exports = ClairClientError;
