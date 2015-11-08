/**
 * Author: Prashanth Narayanaswamy
 */

var SABRE_HOST = "api.test.sabre.com";
var SABRE_API_KEY = "Bearer T1RLAQJmSMSisbtK2Fdo04htboIVMKDhmhCLRlnV4KqrLNQ/isYarDs8AACgz9U9/6t94g0k0jxogS94mA6mSsOxN+gY5pezPLr3akWb5V38X6ceUu+TFe/fw1sMl03wPoo3DDfS8hiT/vqpAWoeFEOYcTgW9+jctxmW8ZEG9Z4sOS1zvmTqE1xvqa4hrIjhk7YTJRVsEG47ZSNgWxh1xa/kWapXKYOVFcboQWRHFkiVdnYBySzRi9qJDQ/cxght4IYQku1WNHue51iMKA**";
var SABRE_API = "/v1/shop/flights";

var httpUtil = require("../../common/httputil")();
var geoUtil = require("../../common/geoutil")();
var Q = require("../../node_modules/q/q");
var opengraph = require('../../common/opengraph.js');
var underscore = require("../../node_modules/underscore/underscore")

module.exports = function(app) {

  var router = app.loopback.Router();

  router.get('/flightDeals', function(req, res) {

    var src = req.query.src;
    var dst = req.query.dst;
    var departureDate = req.query.departure;
    var returnDate = req.query.return;

    var headers = {
      'Authorization': SABRE_API_KEY,
      'X-Originating-Ip': '208.71.159.194'
    };

    httpUtil.performGet(SABRE_HOST,
      SABRE_API + "?origin=" + encodeURIComponent(src) + "&destination=" + encodeURIComponent(dst) +
      "&departuredate=" + encodeURIComponent(departureDate) + "&returndate=" + encodeURIComponent(returnDate) +
      "&onlineitinerariesonly=N&limit=10&offset=1&eticketsonly=N&sortby=totalfare&order=asc&sortby2=departuretime&order2=asc",
      headers,
      function responseCallback(statusCode, response) {
        if (statusCode != 200) {
          console.error("Failed to fetch flight deals from Sabre!. Error: " + statusCode);
          res.status(500).send('Failed to fetch deals!');
          return;
        }

        var deals = JSON.parse(response);
        console.info(deals.PricedItineraries.length + " deals found from Sabre!.");

        retDeals = [];
        for (i = 0; i < deals.PricedItineraries.length; i++) {

          var deal = deals.PricedItineraries[i];
          var depObj = deal.AirItinerary.OriginDestinationOptions.OriginDestinationOption[0];
          var retObj = deal.AirItinerary.OriginDestinationOptions.OriginDestinationOption[1];

          var retDeal = {
            dep: {},
            ret: {}
          };
          retDeal.dep.from = depObj.FlightSegment[0].DepartureAirport.LocationCode;
          retDeal.dep.to = depObj.FlightSegment[0].ArrivalAirport.LocationCode;
          retDeal.dep.flight = depObj.FlightSegment[0].OperatingAirline.Code + " " + depObj.FlightSegment[0].OperatingAirline.FlightNumber;

          retDeal.ret.from = retObj.FlightSegment[0].DepartureAirport.LocationCode;
          retDeal.ret.to = retObj.FlightSegment[0].ArrivalAirport.LocationCode;
          retDeal.ret.flight = retObj.FlightSegment[0].OperatingAirline.Code + " " + retObj.FlightSegment[0].OperatingAirline.FlightNumber;

          retDeal.fare = deal.AirItineraryPricingInfo.ItinTotalFare.TotalFare.Amount;

          retDeals.push(retDeal);
        }
        res.send(JSON.stringify(retDeals));
      });
  });
  app.use(router);
}
