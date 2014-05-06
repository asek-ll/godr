module.exports = function setup(options, imports, register) {
  var lconf = imports.local_config;
  var gapi = imports.gapi;
  var logger = imports.logger.logger;
  var async = require('async');
  var _ = require('lodash');
  var fs = require('fs');

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
    var token = nconf.get('credentials');
    if(!token){
      return next(new Error('token not exists'));
    }
    logger.verbose('get token', token);
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


  var getToken = function (next) {
    var _token;
    return async.waterfall([
      lconf.load,
      getConfToken,
      function(token, next){
        _token = token;
        return gapi.getTokenInfo(token, next);
      },
    ], function(err,body){
      if(err === 'ivalid_token'){
        return gapi.refreshToken(_token, function (err, token) {
          if(err){
            return next(err);
          }
          return setConfToken(token, function (err) {
            return lconf.save(next);
          });
        });
      }
      if(err){
        return next(err);
      }

      return next(null, _token);
    });
  };


  var checkAndRun = function (process,next) {
    var _token;
    return async.waterfall([
      getToken,
      process,
    ], next);
  };

  var downloadFile = function (token, url, path, next) {
    logger.debug('statrt download ',url,'to', path);
    var request = gapi.downloadRequest(token, url).pipe(fs.createWriteStream(path));
    request.on('end', next);
    request.on('error',next);
  };


  var downloadChildrens = function (next) {

    var _token;
    checkAndRun(function(token,next){
      _token = token;
      return gapi.getChildrenList(token, lconf.nconf.get('remote:id'),next);
    }, function(err, body){
      async.mapSeries(body, function (item, next) {

        if(!item.downloadUrl){
          return next();
        }

        return downloadFile(_token, item.downloadUrl, item.title, next);
      }, next);
    });
  };



  register(null, {
    fsync: {
      init: init,
      refresh: refresh,
      download: downloadChildrens
    },
  });
};
