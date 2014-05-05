module.exports = function setup(options, imports, register) {
  var logger = imports.logger.logger;
  var fsync = imports.fsync;

  var exec = function (argv) {
    logger.verbose('exec command',argv[0]);

    if(argv[0] === 'init'){
      return fsync.init(argv[0], function (err) {
        if(err){
          return logger.error(err);
        }
        logger.info('init successfull');
      });
    }
  };

  register(null, {
    commands: {
      exec: exec
    },
  });
};
