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


Gogi.prototype.uploadFile = function (file, fileData, next) {
  var self = this;
  return this.getClient(function (err, client) {
    if(err){
      return next(err);
    }

    var request = client.drive;
    request.apiMeta.rootUrl = request.apiMeta.rootUrl.substring(0,request.apiMeta.rootUrl.length-1);

    if ( fileData ) {
  //console.log('FILE:',file, fileData);
      return request.files.insert(file)
      .withMedia(file.mimeType, fileData)
      .withAuthClient(self.auth).execute(function (err, body) {
        return next(err, body);
      });
    } 

  //console.log('FOLDER:',file, fileData);
    return request.files.insert(file).withAuthClient(self.auth).execute(function (err, body) {
      return next(err, body);
    });
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
    }).withAuthClient(self.auth).execute(function (err, body) {
      return next(err, body);
    });
  });
};



module.exports = new Gogi();
