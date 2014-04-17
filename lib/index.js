var googleapis = require('googleapis');
var util = require("util");
var events = require("events");
var fs = require("fs");

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
  return googleapis.discover('drive', 'v2').execute(function (err, client) {
    if((!client || err) && errorNext){
      return errorNext(err);
    }
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
  var readable = fs.readStream(filePath);
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



module.exports = Gogi;
