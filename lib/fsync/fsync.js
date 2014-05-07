module.exports = function setup(options, imports, register) {
  var lconf = imports.local_config;
  var gapi = imports.gapi;
  var logger = imports.logger.logger;
  var async = require('async');
  var _ = require('lodash');
  var fs = require('fs');
  var path = require('path');

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
      if(err === 'invalid_token'){
        logger.info('token is invalid');
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
    request.on('close', function () {
      logger.debug('close download connection', path);
      return next();
    });
    request.on('end', function () {
      logger.debug('successful download ', path);
      return next();
    });
    request.on('error',function (err) {
      logger.error('error on  download ', path, err);
      return next(err);
    });
  };


  var saveFileToIndex = function (file, filename, parent, next) {
    return lconf.getIndex().insert({
      filename: filename,
      remoteId: file.id,
      etag: file.etag,
      mimeType: file.mimeType,
      parent: parent._id,
      changed: new Date(),
    }, next);
  };

  var findFileIndex = function (file, parent, next) {
    var query = {
      remoteId: file.remoteId
    };

    if(parent._id){
      query.parent = parent._id;
    }

    return lconf.getIndex().findOne(query, next);
  };

  var getChildFileIndex = function (parent,next) {
    var query;
    if(parent._id){
      query ={ parent: parent._id };
    } else {
      query ={ parent: { $exists: false } };
    }
    return lconf.getIndex().find(query,next);
  };

  var removeFromIndex = function (file, next) {
    //return lconf.getIndex().
    //if (file.mimeType === 'application/vnd.google-apps.folder'){

    //}
  };

  var downloadChildrensRecursive = function (token, parent, next) {
    return gapi.getChildrenList(token, parent.remoteId, function (err, items) {
      return async.mapSeries(items, function (item, next) {

        var newFilename = path.join(parent.filename, item.title);

        if(gapi.isDriveFolder(item)){

          logger.debug('create directory', item.title);

          return fs.mkdir(newFilename, function (err) {
            return saveFileToIndex(item, newFilename, parent, function (err, parent) {
              return downloadChildrensRecursive(token, parent, next);
            });
          });

        }

        if(!item.downloadUrl){
          logger.debug('no download url', item.title);
          return next();
        }
        logger.debug('start download', item.title);

        return downloadFile(token, item.downloadUrl, newFilename, function () {
          return saveFileToIndex(item, newFilename, parent, next);
        });

      }, next);
    });
  };

  var downloadChildrens = function (next) {

    var _token;
    checkAndRun(function(token,next){
      var parent = {
        filename: process.cwd(),
        remoteId: lconf.nconf.get('remote:id'),
        mimeType: 'application/vnd.google-apps.folder',
        parent: null,
        changed: new Date(),
      };

      return downloadChildrensRecursive(token, parent, next);

    }, next);
  };


  var downSyncRecursive = function (token, parent, next) {
    var _remoteFiles;
    async.waterfall(
      [ function(next){
      return gapi.getChildrenList(token, parent.remoteId, next);
    }, function (items, next) {
      _remoteFiles = _.indexBy(items, 'id');
      return getChildFileIndex(parent, next);
    },function (index, next) {
      var existed = [];
      var deleted = [];
      var upload = [];

      _.each(index,function (file) {
        if(_remoteFiles[file.remoteId]){
          existed.push(file);
        } else {
          deleted.push(file);
        }
      });

      var existsRemoteIds = _.pluck(existed,'remoteId');
      upload = _.filter(_remoteFiles,function (file) {
        return !_.contains(existsRemoteIds, file.id);
      });

      //logger.debug(existed, deleted);

      async.waterfall([
        function(next){
        return async.mapSeries(upload, function (item, next) {

          var newFilename = path.join(parent.filename, item.title);

          if(gapi.isDriveFolder(item)){

            logger.debug('create directory', item.title);

            return fs.mkdir(newFilename, function (err) {
              return saveFileToIndex(item, newFilename, parent, function (err, parent) {
                return downSyncRecursive(token, parent, next);
              });
            });

          }

          if(!item.downloadUrl){
            logger.debug('no download url', item.title);
            return next();
          }
          logger.debug('start download', item.title);

          return downloadFile(token, item.downloadUrl, newFilename, function () {
            return saveFileToIndex(item, newFilename, parent, next);
          });

        }, next);
      },
      function(result, next){
        return async.mapSeries(deleted, function (file, next) {
          return fs.unlink(file.filename, next);
        }, next);
      }
      ], next);

    }
    ], next);
  };


  var doDownSync = function (next) {

    var _token;
    checkAndRun(function(token,next){
      var parent = {
        filename: process.cwd(),
        remoteId: lconf.nconf.get('remote:id'),
        mimeType: 'application/vnd.google-apps.folder',
        parent: null,
        changed: new Date(),
      };

      return downSyncRecursive(token, parent, next);

    }, next);
  };


  register(null, {
    fsync: {
      init: init,
      refresh: refresh,
      //download: downloadChildrens,
      download: doDownSync
    },
  });
};
