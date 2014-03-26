var googleapis = require('googleapis'),
          gogi = require('./lib/index.js'),
         nconf = require('nconf'),
          path = require('path'),
         Index = require('./lib/findex.js'),
      optimist = require('optimist'),
             _ = require('underscore'),
      readline = require('readline'),
      open = require('open');

nconf.file(path.join(process.cwd(),'.gogi/config.json'));
gogi.clientSettings(nconf.get('client'));
gogi.loadConfig(nconf.get('credential'));


var argv = optimist.argv;

if(argv._.length > 0){
  if(argv._[0] === 'token'){

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    var url = gogi.auth.generateAuthUrl({
      access_type: 'offline', // will return a refresh token
      scope: nconf.get('client:scope')
    });

    console.log('Visit the url: ', url);
    open(url);

    rl.question('Enter the code here:', function(code) {
      // request access token
      return gogi.auth.getToken(code, function(err, tokens) {
        // set tokens to the client
        // TODO: tokens should be set by OAuth2 client.
        //oauth2Client.setCredentials(tokens);
        //callback();
        nconf.set('credential', tokens);
        return nconf.save(function (err) {
          console.log(tokens);
          rl.close();
        });
      });
    });
  }
  if(argv._[0] === 'test'){
    gogi.findFile('.gogi', function (err, body) {
      console.log(err, body.items[0]);
      if(body.items.length === 0){
        return gogi.createFolder('.gogi', function (err, body) {
          console.log(err, body);
        });
      }
    });
  }
  if(argv._[0] === 'push'){

    var index = new Index(process.cwd());
    index.load(function (err, files) {
      if(err){
        return;
      }

      _.each(files, function (file) {
        console.log(file.path);
      });


    });
  }
  if(argv._[0] === 'add'){

    var index = new Index(process.cwd());
    index.add('.', console.log);

  }
}

//gogi.uploadFile('CustomTitle','text/plain', 'hello world', function (err, body) {
  //console.log(err, body);
//});
