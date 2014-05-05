module.exports = function setup(options, imports, register) {
  var intel = require('intel');
  //var transports = [
    //new (winston.transports.Console)()
  //];

  var config = {
    formatters: {
      'simple': {
        'format': '%(date)s [%(levelname)s] %(message)s',
        'datefmt': "%H:%M-%S",
        'colorize': true
      },
      'details': {
        'format': '[%(date)s] %(name)s.%(levelname)s: %(message)s'
      }
    },
    handlers: {
      'terminal': {
        'class': intel.handlers.Console,
        'formatter': 'simple',
        'level': options.level?intel[options.level]:intel.VERBOSE
      },
      'logfile': {
        'class': intel.handlers.File,
        'level': intel.WARN,
        'file': options.file,
        'formatter': 'details',
      }
    },
    loggers: {
      'patrol': {
        'handlers': ['terminal'],
        'handleExceptions': true,
        'exitOnError': false,
        'propagate': false
      }
    }
  };

  if(options.file){
    config.loggers.patrol.handlers.push('logfile');
  }

  intel.config(config);
  var logger = intel.getLogger('patrol');

  //var logger = new (winston.Logger)({
    //transports: transports
  //});

  register(null, {
    logger: {
      logger: logger
    },
  });

};
