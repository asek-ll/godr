var googleapis = require('googleapis');
var Gogi = function(){
  this.config = {};
};

Gogi.prototype.clientSettings = function (client) {
  this.auth = new googleapis.OAuth2Client(client.id, client.secret, client.redirect_url);
};

Gogi.prototype.loadConfig = function (credentials) {
  this.auth.credentials = credentials;
};

Gogi.prototype.getClient = function (next, errorNext) {
  var self = this;
  return googleapis.discover('drive', 'v2').execute(function (err, client) {
    client.withAuthClient(self.auth);

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
  return obj.withAuthClient(this.auth).execute(next);
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
