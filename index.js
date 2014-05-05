var googleapis = require('googleapis'),
          Gogi = require('./lib/index.js'),
         nconf = require('nconf'),
          path = require('path'),
         Index = require('./lib/findex.js'),
      optimist = require('optimist'),
             _ = require('underscore'),
      readline = require('readline'),
      open = require('open'),
      async = require('async');

nconf.file(path.join(process.cwd(),'.gogi/config.json'));

var settings = require('./settings.json');
var clientData = settings.client;

var gogi = new Gogi(clientData.id, clientData.secret, clientData.redirect_url);
if(nconf.get('credential')){
  gogi.setCredentials(nconf.get('credential'));
}

gogi.on('credentials_change', function (credentials) {
  nconf.set('credential', credentials);
  return nconf.save();
});

//googleapis.discover('drive', 'v2').execute(function (err, client) {
  //console.log(client.drive.files.insert(), err);
//});

var argv = optimist.argv;

if(argv._.length > 0){
  if(argv._[0] === 'token'){

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    var url = gogi.auth.generateAuthUrl({
      access_type: 'offline', // will return a refresh token
      scope: clientData.scope
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
  if(argv._[0] === 'init'){
    var remote= nconf.get('remote');

    var saveRemote = function(file){
      console.log(file);
      if(remote.id !== file.id){
        nconf.set('remote:id', file.id);
        return nconf.save();
      }
    };

    var createFolder = function () {
      return gogi.createFolder(remote.name, function (err, file) {
        return saveRemote(file);
      });
    };

    if(remote.id){
      gogi.getFile(remote.id, function (err, body) {
        if(err && err.code === 404){
          return createFolder();
        }

        return saveRemote(body);
      });
    } else {
      gogi.findFile(remote.name, function (err, body) {
        //console.log(err, body.items[0]);
        if(body.items.length === 0){
          return createFolder();
        }
        return saveRemote(body.items[0]);
      });
    }

  }
  if(argv._[0] === 'push'){

    var index = new Index(process.cwd());
    index.load(function (err, files) {
      if(err){
        return;
      }

      var filesBypass = function (files, parentId, parentName, next) {

        return async.eachSeries(files, function (file, next) {
          var fullFileName = path.join(parentName, file.name);

          if(file.files){
            return gogi.uploadFile({title: file.name, mimeType: 'application/vnd.google-apps.folder', parents:[{id:parentId}]}, null, function (err, body) {

              if(!err){
                console.log("create folder", body.title);
              } else{
                console.log(err);
              }
              //console.log(err, body);

              if(body){
                return filesBypass(file.files, body.id, fullFileName, next);
              }

              return next();
            });
          }

          //return gogi.uploadFile({title: file.name, mimeType: file.mime}, 'dummy', function (err, body) {
          return gogi.uploadFile2({title: file.name, mimeType: file.mime, parents:[{id:parentId}]}, fullFileName, function (err, body) {

            //console.log(err, body);
              if(!err){
                console.log("upload file", body.title);
              } else{
                console.log(err);
              }
            //body
            return next();
          });



        }, next);

      };

      filesBypass(files, nconf.get('remote:id'),'', function (err) {
        console.log("done");
      });

    });
  }


  if(argv._[0] === 'add'){

    var index = new Index(process.cwd());
    index.add('.', console.log);

  }

  if(argv._[0] === 'refresh'){
    gogi.refreshToken(function (err) {
      //console.log(err);
    });
  }


  if(argv._[0] === 'upload_test'){

    gogi.uploadFile2({title:'pix3.txt',mimeType:'text/plain'}, 'test2.txt', function (err, body) {
    //gogi.uploadFile2({title:'test.txt',mimeType:'text/plain'}, 'index.js', function (err, body) {
      console.log(err?err.code:null, body);
    });

  }

  if(argv._[0] === 'test'){
    var remoteDir = argv._[1];
    console.log('work fine', remoteDir);
  }
}

