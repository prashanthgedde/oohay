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

var GEODE_HOST = "geode-demo.herokuapp.com";
var GEODE_PLACES_API = "/findNearby.json";

var httpUtil = require("../../common/httputil")();
var geoUtil = require("../../common/geoutil")();
var Q = require("../../node_modules/q/q");
var opengraph = require('../../common/opengraph.js');
var underscore = require("../../node_modules/underscore/underscore")

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


    function retrieveAirPortsFromGlobefeed(paramObj) {

      //console.info('creating promise for retrieveAirPortsFromGeoloc');

      return Q.promise(function(resolve, reject, notify) {

        //console.info('About to invoke http req on globefeed');
        var url = "http://airport.globefeed.com/US_Nearest_Airport_Result.asp?lat=" + paramObj.geo.lat + "&lng=" + paramObj.geo.lon;
        opengraph.getHTML(url, function(html) {

          var airports = opengraph.parse(html);
          //console.info('opengraph returned: ');
          //console.info(airports);

          airports = underscore.filter(airports, function(airport) {
            //console.info('Checking for valid airport');
            return airport.iata_code && airport.iata_code.length;
          });

          console.info(airports.length + " Airports found for " + paramObj.geo.lat + ", " + paramObj.geo.lon);

          paramObj.geo.airport.available = false;
          if (airports.length) {
            paramObj.geo.airport.available = true;
            paramObj.geo.airport.name = airports[0].name;
            paramObj.geo.airport.code = airports[0].iata_code;
            paramObj.geo.airport.dist = airports[0].distance;
          }
          resolve(paramObj);
        });
      });
    }

    function retrieveAirPort(paramObj) {
      console.info('creating promise');
      return Q.promise(function(resolve, reject, notify) {
        var headers = {
          'Content-Type': 'application/json'
        };
        //console.info('Inside Promise...');
        httpUtil.performGet(GEODE_HOST,
          //GOOGLE_PLACES_API + "?location=" + encodeURIComponent(paramObj.geo.lat + ", " + paramObj.geo.lon) + "&radius=400" +
          //"&types=airport&key=" + GOOGLE_API_KEY,
          GEODE_PLACES_API + "?maxRows=10&fcode=AIRP&lat=" + paramObj.geo.lat + "&lng=" + paramObj.geo.lon + "&radius=200",
          headers,
          function responseCallback(statusCode, response) {

            //console.info("Response from Geode: " + statusCode + ", Response: " + response);
            if (statusCode != 200) {
              console.error("Failed to find nearest airports for " + paramObj.geo.lat + ", " + paramObj.geo.lon);
              res.status(500).match('Failed to fetch airports!');
              paramObj.geo.airport.available = false;
            } else {
              var airPorts = JSON.parse(response);
              paramObj.geo.airport.available = false;
              for (i = 0; i < airPorts.results.geonames.length; i++) {
                var airp = airPorts.results.geonames[i];
                if (airp.name.match(/municipal|ranch/i) == null) {
                  paramObj.geo.airport.available = true;
                  paramObj.geo.airport.name = airp.name + ", " + airp.adminName1;
                  paramObj.geo.airport.dist = airp.distance;
                  break;
                }
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
          console.error("Failed to fetch events from Xola!. Error: " + statusCode);
          res.status(500).send('Failed to fetch events!');
        }

        obj = JSON.parse(response);
        console.info(obj.data.length + " events found from Xola!.");

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
          promise = retrieveAirPortsFromGlobefeed(newObj);
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
