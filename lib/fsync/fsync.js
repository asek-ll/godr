module.exports = function setup(options, imports, register) {
  var lconf = imports.local_config;
  var gapi = imports.gapi;
  var logger = imports.logger.logger;
  var async = require('async');

  var init = function (remoteDir, next) {
    var gapiToken;
    async.waterfall([
      function (next) {
        return lconf.exists(function (exists) {
          if(exists){
            return next(new Error('config already exists'));
          }
          return next();
        });
      },
      lconf.create,
      gapi.getToken,
      function (token, next) {
        logger.debug("get token", token);
        gapiToken = token;
        lconf.nconf.set('credentials', token);
        lconf.nconf.set('remote:name', remoteDir);
        return next(null, token, remoteDir);
      },
      gapi.getFileByTitle,
      function (file, next) {
        if(file){
          logger.debug("file exists", file.title, file.id);
          return next(null, file);
        }
        return gapi.createFolder(gapiToken, remoteDir, next);
      }
    ], function(err, file){

      logger.debug("file recieved", file.title, file.id);
      lconf.nconf.set('remote:id', file.id);
      return lconf.nconf.save(next);
    });
  };

  var getConfToken = function (nconf, next) {
    logger.verbose('get token', nconf.get('credentials'));
    return next(null, nconf.get('credentials'));
  };

  var setConfToken = function (token, next) {
    logger.verbose('set token', token);
    return next(null, lconf.nconf.set('credentials', token));
  };

  var refresh = function (next) {
    return async.waterfall([
      lconf.load,
      getConfToken,
      gapi.refreshToken,
      setConfToken,
      lconf.save
    ], next);
  };

  //async.waterfall([
    //lconf.load,
    //getConfToken,
    //gapi.getTokenInfo,
  //], function (err, body) {
    //logger.debug(err, body);
  //});

  register(null, {
    fsync: {
      init: init,
      refresh: refresh
    },
  });
};
