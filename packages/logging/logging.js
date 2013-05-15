// @export Log
Log = function () {
  return Log.info.apply(this, arguments);
};

var intercept = 0;
var interceptedLines = [];

// Intercept the next 'count' calls to a Log function. The actual
// lines printed to the console can be cleared and read by calling
// Log._intercepted().
Log._intercept = function (count) {
  intercept += count;
};
Log._intercepted = function () {
  var lines = interceptedLines;
  interceptedLines = [];
  return lines;
};

// XXX file, line, package
var RESTRICTED_KEYS = ['time', 'timeInexact', 'level'];

_.each(['debug', 'info', 'warn', 'error'], function (level) {
  Log[level] = function (arg) {
    var intercepted;
    if (intercept) {
      intercept--;
      intercepted = true;
    }

    var obj = (typeof arg === 'string') ? {message: arg} : arg;

    _.each(RESTRICTED_KEYS, function (key) {
      if (obj[key])
        throw new Error("Can't set '" + key + "' in log message");
    });

    obj.time = new Date();
    obj.level = level;
    // XXX file, line, package

    // XXX allow you to enable 'debug', probably per-package
    if (level === 'debug')
      return;

    if (intercepted) {
      interceptedLines.push(EJSON.stringify(obj));
    } else if (Meteor.isServer) {
      console.log(EJSON.stringify(obj));
    } else {
      // XXX Some levels should be probably be sent to the server
      // XXX Uses of Meteor._debug should probably be replaced by Log.debug or
      //     Log.info, and we should have another name for "do your best to
      //     call call console.log".
      Meteor._debug(Log.format(obj));
    }
  };
});

// tries to parse line as EJSON. returns object if parse is successful, or null if not
Log.parse = function (line) {
  var obj = null;
  if (line && line[0] === '{') { // might be json generated from calling 'Log'
    try { obj = EJSON.parse(line); } catch (e) {}
  }
  return obj;
};

var LEVEL_COLORS = {
  debug: 'blue',
  info: 'cyan',
  warn: 'yellow',
  error: 'red'
};

// formats a log object into colored human and machine-readable text
Log.format = function (obj, options) {
  options = options || {};

  var time = obj.time;
  if (!(time instanceof Date))
    throw new Error("'time' must be a Date object");
  var timeInexact = obj.timeInexact;

  var level = obj.level || 'info';

  _.each(RESTRICTED_KEYS, function(key) {
    delete obj[key];
  });

  var message = obj.message || '';
  delete obj.message;
  if (!_.isEmpty(obj)) {
    if (message) message += " ";
    message += EJSON.stringify(obj);
  }

  var pad2 = function(n) { return n < 10 ? '0' + n : n; };
  var pad3 = function(n) { return n < 100 ? '0' + pad2(n) : n; };

  var dateStamp = time.getFullYear() +
    pad2(time.getMonth() + 1 /*0-based*/) +
    pad2(time.getDate());
  var timeStamp = pad2(time.getHours()) +
        ':' +
        pad2(time.getMinutes()) +
        ':' +
        pad2(time.getSeconds()) +
        '.' +
        pad3(time.getMilliseconds());

  var line = [
    level.charAt(0).toUpperCase(),
    dateStamp,
    '-',
    timeStamp,
    timeInexact ? '?' : ' ',
    message].join('');

  if (options.color && Meteor.isServer) {
    var color = LEVEL_COLORS[level];
    if (color)
      line = Npm.require('cli-color')[color](line);
  }

  return line;
};
