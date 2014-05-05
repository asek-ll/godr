module.exports = function setup(options, imports, register) {
  var fs = require('fs');
  var path = require('path');
  var nconf = require('nconf');
  var fileDir = path.join(process.cwd(),'.gogi');
  var filePath = path.join(fileDir,'config.json');

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

  var load= function (next) {
    return exists(function (exists) {
      if(!exists){
        return next(new Error('config file not exists'));
      }
      nconf.file(filePath);
      return next(nconf);
    });
  };

  return register(null, {
    local_config: {
      exists: exists,
      create: create,
      load: load,
      nconf: nconf
    }
  });
};
