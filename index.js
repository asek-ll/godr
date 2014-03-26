var googleapis = require('googleapis'),
gogi = require('./lib/index.js'),
nconf = require('nconf'),
path = require('path'),
Index = require('./lib/findex.js'),
_ = require('underscore');


nconf.file(path.join(process.cwd(),'.gogi/config.json'));

gogi.loadConfig(nconf.get('credential'));
/*
gogi.findFile('.gogi', function (err, body) {
  console.log(body.items);
  if(body.items.length === 0){
    return gogi.createFolder('.gogi', function (err, body) {
      console.log(err, body);
    });
  }
});

//files.getFiles(process.cwd(),'.', console.log);
var index = new Index(process.cwd());

index.add('.', console.log);

*/
gogi.uploadFile('CustomTitle','text/plain', 'hello world', function (err, body) {
  //console.log(err, body);
});
