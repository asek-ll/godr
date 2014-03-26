var googleapis = require('googleapis');

var CLIENT_ID = '274126404141.apps.googleusercontent.com',
    CLIENT_SECRET = '_QQDykIrzBjDcNAcBCsidvBV',
    REDIRECT_URL = 'urn:ietf:wg:oauth:2.0:oob',
    SCOPE = 'https://www.googleapis.com/auth/drive';

var Gogi = function(){
  this.config = {};
  this.auth = new googleapis.OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
};

Gogi.prototype.loadConfig = function (credentials) {
  this.auth.credentials = credentials;
};

Gogi.prototype.getClient = function (next) {
  var self = this;
  if(self.client){
    return next(null, self.client);
  }

  return googleapis.discover('drive', 'v2').execute(function (err, client) {
    self.client = client;
    return next(err, client);
  });
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
    return client.drive.files.list({q:encodeURI("title='"+title+"'")}).withAuthClient(self.auth).execute(function (err, body) {
      return next(err, body);
    });
  });
};

Gogi.prototype.authExecute = function (next) {

};

Gogi.prototype.createFolder = function (title, next) {
  var self = this;
  return this.getClient(function (err, client) {
    if(err){
      return next(err);
    }
    var request = client.drive;
    request.apiMeta.rootUrl = request.apiMeta.rootUrl.substring(0,request.apiMeta.rootUrl.length-1);

    return request.files.insert({title: title, mimeType: 'application/vnd.google-apps.folder'})
    .withAuthClient(self.auth).execute(function (err, body) {
      return next(err, body);
    });

  });

};


Gogi.prototype.uploadFile = function (title, mimeType, fileData, next) {
  var self = this;
  return this.getClient(function (err, client) {
    if(err){
      return next(err);
    }

    var request = client.drive;
    request.apiMeta.rootUrl = request.apiMeta.rootUrl.substring(0,request.apiMeta.rootUrl.length-1);
    console.log(request.apiMeta.rootUrl);

    return request.files.insert({title: title, mimeType: mimeType})
    .withMedia(mimeType, fileData)
    .withAuthClient(self.auth).execute(function (err, body) {
      return next(err, body);
    });
  });
};

module.exports = new Gogi();
