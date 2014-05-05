var googleapis = require('googleapis');
var util = require("util");
var events = require("events");
var fs = require("fs");
var logger = require('./logger.js');
var url = require('url');
var https = require('https');

var Gogi = function(id, secret, redirect_url){
  this.auth = new googleapis.OAuth2Client(id, secret, redirect_url);
  events.EventEmitter.call(this);
};

util.inherits(Gogi, events.EventEmitter);

Gogi.prototype.setCredentials = function (credentials) {
  this.auth.credentials = credentials;
  if(this.auth.credentials.refresh_token){
    this.refresh_token = this.auth.credentials.refresh_token;
    delete this.auth.credentials.refresh_token;
  }
};

Gogi.prototype.getClient = function (next, errorNext) {
  var self = this;
  logger.info('do drive v2 client discover request');
  return googleapis.discover('drive', 'v2').execute(function (err, client) {
    if((!client || err) && errorNext){
      return errorNext(err);
    }
    logger.info('done');
    return next(err, client);
  });
};

Gogi.prototype.executeWithClient = function (next) {
  var self = this;
  return self.getClient(function (err, client) {
    return next(err, client);
  }, next);
};

Gogi.prototype.getAccessTokens = function (code, next) {
  var self = this;

  return this.auth.getToken(code, function(err, tokens) {
    if (err) {
      return next(err);
    }
    self.auth.credentials = tokens;
    return next(err);
  });
};

Gogi.prototype.findFile = function (title, next) {
  var self = this;
  return this.getClient(function (err, client) {
    if(err){
      return next(err);
    }
    return client.drive.files.list({q:encodeURI("title='"+title+"'")}).execute(function (err, body) {
      return next(err, body);
    });
  });
};

Gogi.prototype.authExecute = function (obj, next) {
  var self = this;
  return obj.withAuthClient(this.auth).execute(function (err, body) {
    if(err && err.code === 401 && self.refresh_token){
      self.auth.credentials.refresh_token = self.refresh_token;
      return self.auth.refreshAccessToken(function (err) {
        if(!err){
          self.emit('credentials_change', self.auth.credentials);
          self.setCredentials(self.auth.credentials);
          return obj.withAuthClient(this.auth).execute(next);
        }
        return next(err);
      });
    }
    return next(err, body);
  });
};

Gogi.prototype.refreshToken = function (next) {
  var self = this;
  if(self.refresh_token){
    self.auth.credentials.refresh_token = self.refresh_token;
    logger.info('request access token by refresh token');
    return self.auth.refreshAccessToken(function (err) {
      if(!err){
        logger.info('get it, change credentials');
        self.emit('credentials_change', self.auth.credentials);
        self.setCredentials(self.auth.credentials);
      } else {
        logger.info('get error', err);
      }
      return next(err);
    });
  }
  return next(new Error("No refresh token"));
};

Gogi.prototype.createFolder = function (title, next) {
  return this.uploadFile({title: title, mimeType: 'application/vnd.google-apps.folder'}, null, next);
};


Gogi.prototype.uploadFile = function (file, fileData, next) {
  var self = this;
  self.executeWithClient(function (err, client) {
    var request = client.drive;
    request.apiMeta.rootUrl = request.apiMeta.rootUrl.substring(0,request.apiMeta.rootUrl.length-1);

    request = request.files.insert(file);

    if ( fileData ) {
      request.withMedia(file.mimeType, fileData);
    } 
    return self.authExecute(request, next);
  });
};

Gogi.prototype.uploadFile2 = function (fileData, filePath, next) {
  var self = this;

  self.executeWithClient(function (err, client) {
    var request = client.drive;
    request.apiMeta.rootUrl = request.apiMeta.rootUrl.substring(0,request.apiMeta.rootUrl.length-1);
    request = request.files.insert(fileData).withMedia({});
    var params = request.params || {};
    params.uploadType = 'resumable';

    var fileStat = fs.statSync(filePath);
    var fileSize = fileStat.size;
    var progress = 0;
    var mimeType = request.body.mimeType;
    delete request.body.mimeType;

    var uploadBody = {
      uri: request.generateMethodUri(params),
      method: request.methodMeta.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': fileStat.size,
      },
      body: JSON.stringify(request.body)
    };
    logger.info('do resumable upload first request');
    return self.auth.request(uploadBody, request.handleResponse(function (err, body, res) {
      if(err){
        logger.error(err);
        return next(err);
      }
      var uploadUri = res.headers.location;

      logger.info('success get upload uri', uploadUri);

      var readable = fs.createReadStream(filePath);

      var readablePause = false;
      var readableReady = false;
      var readableEnd = false;

      var readableError = function (err) {
        return next(err);
      };

      var lastResponse = {};

      var processChunk = function (chunk, next) {

        //console.log(chunk.length);
        //return next();

        return self.uploadResumableChunk(uploadUri, chunk, progress, fileSize, mimeType, function (err, body) {
          if(err){
            return next(err);
          }
          progress += chunk.length;
          //return setTimeout(function () {
            //return next();
          //},10000);
          lastResponse = body;
          return next();
        });

      };

      var initChunkData = function(){
        readableReady = false;
        readablePause = true;
        var chunk = readable.read(1024* 1024);

        //console.log("another chunk", chunk ? chunk.length : 'empty');

        if(!chunk){

          if(readableReady){
            return initChunkData();
          }
          readablePause = false;

          if(readableEnd){
            return next(null, lastResponse);
          }
          return;
        }

        return processChunk(chunk, function (err) {
          if(err){
            return readableError(err);
          }
          readablePause = false;
          //if(readableReady){
            return initChunkData();
          //}
        });
      };


      readable.on('error', function (err) {
        console.log("error: ",err);
        return readableError(err);
      });

      readable.on('readable', function () {
        //var chunk;
        readableReady = true;
        if(!readablePause){
          initChunkData();
        }
      });

      readable.on('end', function() {
        logger.info('end of file, upload end');
        readableEnd = true;
        //return next();
      });

    }));
  });
};


Gogi.prototype.uploadResumableChunk = function (uploadUri, chunk, progress, fileSize, mimeType, next) {
  var self = this;
  var uploadPartBody = {
    uri: uploadUri,
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': chunk.length,
    },
    body: chunk.toString(),
  };


  var credentials = self.auth.credentials;
  credentials.token_type = credentials.token_type || 'Bearer';
  uploadPartBody.headers.Authorization = credentials.token_type + ' ' + credentials.access_token;


  if(fileSize > chunk.length){
    uploadPartBody.headers['Content-Range'] = 'bytes '+progress+'-'+(progress+chunk.length-1)+'/'+fileSize;
  }

  logger.info('read %d bytes of file, total progress = %d', chunk.length, progress);

  logger.info('upload chunk to server, with headers',uploadPartBody.headers);

  var doUploadPartBody = function(step){
    var waitDelay = Math.floor((step + Math.random()) * 1000);
    //logger.info('do upload step ',step, uploadPartBody);
    //return request(uploadPartBody,function (err, body, res) {
    return self.simpleRequest(uploadPartBody,function (err, body, res) {
      console.log('after upload', err?err.code:null);
      if(err){
        //logger.error('failed to upload chunk to server', err);
        return next(err);
      }

      if(res.statusCode === 503){

        if(step < 16){
          logger.info('wait for',waitDelay);
          return setTimeout(function () {
            doUploadPartBody(step*2);
          }, waitDelay);

        } 
        return next(new Error("server 503"));

      } 

      logger.info('success upload to server');

      if(body){
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = {};
        }
      }

      return next(null, body);

    });
  };
  return doUploadPartBody(1);
};


Gogi.prototype.getFile = function (id, next) {
  var self = this;
  return this.getClient(function (err, client) {
    if(err){
      return next(err);
    }
    return client.drive.files.get({
      'fileId': id
    }).execute(function (err, body) {
      return next(err, body);
    });
  });
};

Gogi.prototype.simpleRequest = function (options, next) {
  var parsedUri = url.parse(options.uri);
  delete options.uri;

  var body = options.body;
  delete options.body;

  options.hostname = parsedUri.hostname;
  options.path = parsedUri.path;
  //console.log("---------");
  //console.log("start request");

  var d = require('domain').create();
  d.on('error',function (err) {
    //console.log('ohh, domain error', err.code);
    //d.dispose();
    //return next(err);
  });

  d.run(function () {

    var req = https.request(options, function (res) {

      //res.setEncoding('utf8');
      //console.log("get response ", res.statusCode);
      //console.log("---------");
      var data = "";
      res.on('data', function (chunk) {
        //console.log("---------------------------------------req:",req.uri);
        //console.log('body',chunk.toString());
        data += chunk.toString();
      });

      res.on('end', function () {
        //console.log("----------------------------------------finish");
        //console.log(data);
        return next(null, data, res);
      });


    });

    req.on('error', function (e) {
      console.log('ERRoooooR',e);
      return next(e, {}, {});
    });

    req.write(body);

    req.end();
  });

  //return next(null, {}, {});
};

module.exports = Gogi;
