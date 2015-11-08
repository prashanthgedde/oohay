/**
 * Author: Prashanth Narayanaswamy
 */

var XOLA_HOST = "dev.xola.com";
var XOLA_API_KEY = "6-vM2b25x24VAOVmQucBDR2SlC2XgfZ5E3yaOq9FPCM";
var XOLA_EXPERIENCES_API = "/api/experiences";

var DISTANCE_THRESHOLD = 500; // 500 Kms

var GOOGLE_HOST = "maps.googleapis.com";
var GOOGLE_API_KEY = "AIzaSyCNavATmxBZgCR4Uzd4XGzOKbiZgt7mcNE";
var GOOGLE_PLACES_API = "/maps/api/place/nearbysearch/json";

var httpUtil = require("../../common/httputil")();
var geoUtil = require("../../common/geoutil")();
var Q = require("../../node_modules/q/q");

module.exports = function(app) {

  var router = app.loopback.Router();

  router.get('/events', function(req, res) {

    var interests = req.query.interests;
    var slat = req.query.lat;
    var slon = req.query.lon;
    var srad = req.query.rad;
    var limit = req.query.limit;

    var headers = {
      'Content-Type': 'application/json',
      'X-API-KEY': XOLA_API_KEY
    };

    function retrieveAirPort(paramObj) {
      console.info('creating promise');
      return Q.promise(function(resolve, reject, notify) {
        var headers = {
          'Content-Type': 'application/json'
        };
        console.info('Inside Promise...');
        httpUtil.performGet(GOOGLE_HOST,
          GOOGLE_PLACES_API + "?location=" + encodeURIComponent(paramObj.geo.lat + ", " + paramObj.geo.lon) + "&radius=400" +
          "&types=airport&key=" + GOOGLE_API_KEY,
          headers,
          function responseCallback(statusCode, response) {

            console.info("Response from Google: " + statusCode + ", Response: " + response);
            if (statusCode != 200) {
              res.status(500).send('Failed to fetch airports!');
              paramObj.geo.airport.available = false;
            } else {
              var airPorts = JSON.parse(response);
              if (airPorts.status == "OK") {
                paramObj.geo.airport.available = true;
                paramObj.geo.airport.name = airPorts.results[0].name;
                paramObj.geo.airport.address = airPorts.results[0].vicinity;
              } else {
                paramObj.geo.airport.available = false;
              }
            }
            resolve(paramObj);
          });
      });
    }

    httpUtil.performGet(XOLA_HOST,
      XOLA_EXPERIENCES_API + "?category=" + encodeURIComponent(interests) +
      "&geo=" + encodeURIComponent(slat + "," + slon + "," + srad) +
      "&limit=" + limit,
      headers,
      function responseCallback(statusCode, response) {

        if (statusCode != 200) {
          res.status(500).send('Failed to fetch events!');
        }

        obj = JSON.parse(response);
        outObj = [];
        var promises = [];
        for (index = 0; index < obj.data.length; ++index) {

          var data = obj.data[index];
          var geo = data.geo;
          var lat = geo.lat;
          var lon = geo.lng;
          //console.info("Lat: "+lat+", lon: "+lon);
          var dist = geoUtil.getDistanceFromLatLonInKm(slat, slon, lat, lon);

          if (dist <= DISTANCE_THRESHOLD) {
            continue;
          }

          //console.log("Data: ");
          //console.log(data);
          var newObj = {
            "geo": {
              "airport": {}
            }
          };

          newObj.name = data.name;
          newObj.price = data.price;
          newObj.date = data.updated;
          newObj.photo = data.photo && data.photo.src ? data.photo.src : null;
          newObj.category = data.category;
          newObj.desc = data.desc;

          newObj.geo.lat = lat;
          newObj.geo.lon = lon;
          newObj.geo.dist = dist;

          //console.info('1')
          promise = retrieveAirPort(newObj);
          //console.info('2')
          promise.then(function(resultObj) {
            if (resultObj.geo.airport.available == true) {
              outObj.push(resultObj)
            }
          });

          promises.push(promise);
        }

        Q.all(promises).then(function() {
          res.send(JSON.stringify(outObj));
        });
      })
  });
  app.use(router);
}
