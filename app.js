#!/usr/bin/env node

var path = require('path');
var architect = require("architect");
var optimist = require('optimist');

var configPath = path.join(__dirname, "config.js");
var config = architect.loadConfig(configPath);

architect.createApp(config, function (err, app) {
  if (err) {
    throw err;
  }
  var argv = optimist.argv;
  if(argv._.length > 0 && app.services.commands){
    app.services.commands.exec(argv._);
  }
});
