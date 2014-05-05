var path = require('path');

module.exports = [
  "./lib/local_config", 
  "./lib/commands", 
  "./lib/fsync", 
  {packagePath: "./lib/logger", file: path.join(__dirname,'info.log'), level:'VERBOSE'},
  {packagePath: "./lib/gapi", client: require('./settings.json').client}
];
