module.exports = function setup(options, imports, register) {

  var googleapis = require('googleapis');
  var readline = require('readline');
  var open = require('open');
  var async = require('async');
  var request = require('request');

  if(!options.client || !options.client.id || !options.client.secret){
    return register(new Error("empty client data"));
  }

  var auth = new googleapis.OAuth2Client(options.client.id, options.client.secret, options.client.redirect_url);


  var getToken = function (next) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    var url = auth.generateAuthUrl({
      access_type: 'offline',
      scope: options.client.scope
    });

    console.log('Visit the url: ', url);
    open(url);

    rl.question('Enter the code here:', function(code) {
      // request access token
      return auth.getToken(code, function(err, tokens) {
        rl.close();
        return next(err, tokens);
      });
    });
  };

  var refreshToken = function (token, next) {
    auth.credentials = token;
    return auth.refreshAccessToken(function (err) {
      if(err){
        return next(err);
      }
      return next(null, auth.credentials);
    });
  };

  var getClient = function (name, version, next) {
    return googleapis.discover(name, version).execute(next);
  };

  var getDriveClient = function (api, next) {
    return getClient('drive','v2', next);
  };


  var executeWithAuth = function (token, query, next) {
    auth.credentials = token;
    query.withAuthClient(auth).execute(next);
  };

  var clientQuery = function (api, version, token, process, next) {
    return async.waterfall([ 
      function (next) {
        return getClient(api, version, next);
      },
      process,
      function(query, next){
        return next(null, token, query);
      },
      executeWithAuth
    ], next);
  };

  var driveClientQuery = function (token, process, next) {
    return clientQuery('drive', 'v2', token, process, next);
  };

  var getFileById = function (token, id, next) {
    return driveClientQuery(token, function (client, next) {
      return next(null, client.drive.files.get({'fileId': id}));
    }, next);
  };

  var getFileByTitle = function (token, title, next) {
    return driveClientQuery(token, function (client, next) {
      return next(null, client.drive.files.list({q:encodeURI("title='"+title+"'")}));
    }, function (err, body) {
      if(err){
        return next(err);
      }
      return next(null, body.items[0]);
    });
  };

  var uploadFileMedia = function (token, file, fileData, next) {
    return driveClientQuery(token, function (client, next) {
      var request = client.drive;
      request.apiMeta.rootUrl = request.apiMeta.rootUrl.substring(0,request.apiMeta.rootUrl.length-1);
      request = request.files.insert(file);

      if ( fileData ) {
        request.withMedia(file.mimeType, fileData);
      } 

      return next(null, request);
    }, next);
  };

  var createFolder = function (token, title, next) {
    return uploadFileMedia(token, {title: title, mimeType: 'application/vnd.google-apps.folder'}, null, next);
  };

  var getChildrenList = function (token, folderId, next) {
    return driveClientQuery(token, function (client, next) {
      //return next(null, client.drive.children.list({'folderId': folderId}));
      var query = client.drive.files.list({'q': "'"+folderId+"' in parents"});
      return next(null, query);
    }, function (err, body) {
      if(err){
        return next(err);
      }
      return next(null, body.items);
    });
  };

  var getTokenInfo = function (token, next) {
    return clientQuery('oauth2', 'v1', token, function (client, next) {
      return next(null, client.oauth2.tokeninfo({access_token:token.access_token}));
    }, next);
  };

  var authRequest = function (token, body) {
    body.headers = body.headers || [];
    token.token_type = token.token_type || 'Bearer';
    body.headers.Authorization = token.token_type + ' ' + token.access_token;

    return request(body);
  };

  var downloadRequest = function (token, url) {
    return authRequest(token, {
      uri: url,
      method: 'GET',
      headers: { },
    });
  };


  register(null, {
    gapi: {
      auth: auth,
      getToken: getToken,
      refreshToken: refreshToken,
      getFileById: getFileById,
      getFileByTitle: getFileByTitle,
      uploadFileMedia: uploadFileMedia,
      createFolder: createFolder,
      getTokenInfo: getTokenInfo,
      getChildrenList: getChildrenList,
      authRequest: authRequest,
      downloadRequest: downloadRequest
    },
  });
};
