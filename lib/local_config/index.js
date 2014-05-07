module.exports = function setup(options, imports, register) {
  var fs = require('fs');
  var path = require('path');
  var nconf = require('nconf');
  var Nedb = require('Nedb');
  var fileDir = path.join(process.cwd(),'.gogi');
  var filePath = path.join(fileDir,'config.json');
  var indexDbPath = path.join(fileDir,'index.db');

  var index;

  var exists = function (next) {
    return fs.exists(filePath, next);
  };

  var create = function (next) {
    var touchFile = function () {
      return fs.writeFile(filePath, "{}", function (err) {
        nconf.file(filePath);
        return next(err);
      });
    };
    return fs.exists(fileDir,function (exists) {
      if(exists){
        return touchFile();
      }
      return fs.mkdir(fileDir, touchFile);
    });
  };

  var load = function (next) {
    return exists(function (exists) {
      if(!exists){
        return next(new Error('config file not exists'));
      }
      index = new Nedb({filename: indexDbPath, autoload: true});
      nconf.file(filePath);
      return next(null, nconf);
    });
  };

  var getIndex = function () {
    return index;
  };

  var save = function (next) {
    return nconf.save(next);
  };

  return register(null, {
    local_config: {
      exists: exists,
      create: create,
      load: load,
      nconf: nconf,
      getIndex: getIndex,
      save: save
    }
  });
};
