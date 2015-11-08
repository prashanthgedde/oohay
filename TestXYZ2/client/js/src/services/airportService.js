app.service('AirportService', function($injector) {
  'use strict';

  var airports = [{
    "airport_code": "SAT",
    "name": "San Antonio International",
    "place": "San Antonio",
    "country": "United States",
    "country_code": "US",
    "lat": 29.533333,
    "lon": -98.466667
  },
    {
      "airport_code": "SQL",
      "name": "San Carlos",
      "place": "San Carlos",
      "country": "United States",
      "country_code": "US",
      "lat": 37.483333,
      "lon": -122.25
    },
    {
      "airport_code": "SAN",
      "name": "San Diego International Airport",
      "place": "San Diego",
      "country": "United States",
      "country_code": "US",
      "lat": 32.733333,
      "lon": -117.183333
    },
    {
      "airport_code": "SFO",
      "name": "San Francisco International",
      "place": "San Francisco, CA",
      "country": "United States",
      "country_code": "US",
      "lat": 37.618889,
      "lon": -122.375
    }];

  var exports = {};
  exports.fetch = function(){
    return airports;
  };

  return exports;
});
