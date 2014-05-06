module.exports = function setup(options, imports, register) {
  var logger = imports.logger.logger;
  var fsync = imports.fsync;

  var commands = {};

  commands.init = function (argv) {
    return fsync.init(argv[1], function (err) {
      if(err){
        return logger.error(err);
      }
      logger.info('init successfull');
    });
  };


  commands.refresh = function (argv) {
    return fsync.refresh(function (err) {
      if(err){
        return logger.error(err);
      }
      logger.info('refresh successfull');
    });
  };

  commands.download = function (argv) {
    return fsync.download(function (err) {
      logger.info(err, 'download successfull');
    });
  };

  var exec = function (argv) {
    logger.verbose('exec command',argv[0]);

    if(commands[argv[0]]){
      commands[argv[0]](argv);
    }

  };

  register(null, {
    commands: {
      exec: exec
    },
  });
};
