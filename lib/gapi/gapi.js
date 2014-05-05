module.exports = function setup(options, imports, register) {

  var googleapis = require('googleapis');
  var readline = require('readline');
  var open = require('open');
  var async = require('async');

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

  var getClient = function (next) {
    return googleapis.discover('drive', 'v2').execute(next);
  };

  var executeWithAuth = function (token, query, next) {
    auth.credentials = token;
    query.withAuthClient(auth).execute(next);
  };

  var clientQuery = function (token, process, next) {
    return async.waterfall([ 
      getClient,
      process,
      function(query, next){
        return next(token, query);
      },
      executeWithAuth
    ], next);
  };

  var getFileById = function (token, id, next) {
    return clientQuery(token, function (client, next) {
      return next(null, client.drive.files.get({'fileId': id}));
    }, next);
  };

  register(null, {
    gapi: {
      auth: auth,
      getToken: getToken,
      refreshToken: refreshToken
    },
  });
};
