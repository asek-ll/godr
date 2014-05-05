module.exports = function setup(options, imports, register) {
  var lconf = imports.local_config;
  var gapi = imports.gapi;

  var init = function (remoteDir, next) {
    return lconf.exists(function (exists) {
      if(exists){
        return next(new Error('config already exists'));
      }

      return lconf.create(function (err) {
        if(err){
          return next(err);
        }

        lconf.nconf.set('remote:name', remoteDir);

        return gapi.getToken(function (err, token) {
          if(err){
            return next(err);
          }
          lconf.nconf.set('credentials', token);
          return lconf.nconf.save(next);
        });
      });

    });
  };

  register(null, {
    fsync: {
      init: init
    },
  });
};
