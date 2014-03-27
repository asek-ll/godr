var path = require('path');
var async = require('async');
var _ = require('underscore'), fs = require('fs');
var mime = require('mime');

var root = process.cwd();

var Excludes = function (rules) {
  var self = this;

  rules = rules || ['.gigoignore'];
  this.rules = [];
  _.each(rules, function (rule) {
    self.add(rule);
  });
};

Excludes.prototype.add = function(rule) {
  this.rules.push(new RegExp(rule));
};

Excludes.prototype.load = function(file, next) {
  var self = this;

  return fs.readFile(file.path, {encoding:'utf8'}, function (err, data) {
    if(err){
      return next(err);
    }
    var newRules = data.split(/\r?\n/);
    _.each(newRules, function (rule) {

      if(rule.length > 0){
        self.add(rule.replace(/^\s+|\s+$/g, ""));
      }
    });

    return next();
  });
};

Excludes.prototype.test = function(file) {
  var result = _.some(this.rules, function (rule) {
    return rule.test(file.name);
  });

  return result;
};

Excludes.prototype.isExcludeSettings = function (file) {
  return file.name === '.gigoignore';
};

Excludes.prototype.initFiles = function(files, next) {
  var settings = _.filter(files, this.isExcludeSettings), self = this;
  return async.map(settings, function (file, next) {
    return self.load(file, next);
  } , function () {
    return next();
  });
};

var File = function (root, fileName) {
  this.name = fileName;
  this.path = path.join(root, fileName);
};

File.prototype.loadStat = function(next) {
  var self = this;
  
  if(this.stat){
    return next(null, this.stat);
  }

  return fs.stat(this.path, function (err, stat) {
    if(err){
      return next(err);
    }

    self.stat = stat;
    return next(err, stat);
  });
};


var Files = function () {
};

Files.prototype.readdir = function(root, next) {
  var self = this;

  return fs.readdir(root, function (err, files) {
    if(err){
      return next(err);
    }

    var process = function (fileName, next) {
      var file = new File(root, fileName);

      return file.loadStat(function (err) {
        if(err){
          return next(err);
        }

        return next(null, file);
      });
    };

    return async.map(files, process, function (err, files) {
      return next(err, files);
    });
    
  });
};


Files.prototype.getFiles = function (root, path, next) {
  var excludes = new Excludes();
  this.root = root;
  return this._getFiles(path, excludes, next);
};

Files.prototype._getFiles = function(root, excludes, next) {
  var self = this;

  return this.readdir(path.join(self.root, root), function (err, files) {
    return excludes.initFiles(files, function () {
      var filtered = _.reject(files,function (file) {
        return excludes.test(file);
      });
      return async.map(filtered, function (file, next) {
        if(file.stat.isFile()){
          return next(null, {
            name: file.name,
            ctime: file.stat.ctime.getTime(),
            mime: mime.lookup(file.name)
          });
        }
        if(file.stat.isDirectory()){
          var copyExcludes = new Excludes(excludes.rules.slice(0));
          return self._getFiles(path.join(root, file.name), copyExcludes, function (err, files) {
            return next(err, {
              type: 'folder',
              mime: mime.lookup(file.name),
              name: file.name,
              files: files
            });
          });
        }
      },function (err, results) {
        if(results.length === 0){
          return next(err,[]);
        }
        return next(err, results);
      });
    });
  });
};


module.exports = new Files();
