/**
 * Author: Prashanth Narayanaswamy
 */
 
var httpUtil = require("../../common/httputil")("6-vM2b25x24VAOVmQucBDR2SlC2XgfZ5E3yaOq9FPCM");

module.exports = function(app) {


  var router = app.loopback.Router();

  router.get('/events', function(req, res) {

    var interests = req.query.interests;
    var geo = req.query.geo;
    var limit = req.query.limit;

    httpUtil.performGet("dev.xola.com",
      "/api/experiences?category="+encodeURIComponent(interests)+
      "&geo="+encodeURIComponent(geo)+
      "&limit="+limit,
      function responseCallback(statusCode, response) {
        res.send(response);
    })
  });
  app.use(router);
}
