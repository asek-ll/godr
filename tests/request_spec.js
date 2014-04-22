describe('request test', function () {
  var gogi;
  var Gogi = require('../lib/index.js');
  var gogi = new Gogi('CLIENT_ID', 'CLIENT_SECRET', 'CLIENT_REDIRECT_URL');
  gogi.setCredentials({
    "access_token": "access_token",
    "token_type": "Bearer",
    "expires_in": 3600,
    "refresh_token": "refresh_token"
  });

  //beforeEach(function(done){

  //});

  describe('resumable upload', function () {
    it('reumable cleint', function (done) {
      gogi.getClient(function (err, client) {
        console.log(client.drive.files.insert);
        client.should.be.ok;
        done();
      });
    });

  });


});
