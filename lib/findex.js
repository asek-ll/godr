var files = require('./files.js'),
path = require('path'),
fs = require('fs');
var Index;

Index = function(root){
  this.root = root;
};

Index.prototype.add = function(path, next) {
  var self = this;
  return files.getFiles(this.root, path, function (err, files) {
    return self.save(files, next);
  });
};


Index.prototype.save = function (config, next) {
  var filename = path.join(this.root, '.gogi','index.json');
  return fs.writeFile(filename, JSON.stringify(config), function (err) {
    return next(err, config);
  });
};

Index.prototype.load = function(next){
  var filename = path.join(this.root, '.gogi','index.json');
  return fs.readFile(filename, {encoding:'utf8'}, function (err, data) {
    if(err){
      return next(err);
    }
    return next(err, JSON.parse(data));
  });
};


module.exports = Index;
