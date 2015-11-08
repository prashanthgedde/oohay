/**
 * Author: Prashanth Narayanaswamy
 */

var https = require('https');
module.exports = function(apikey) {
  return {
    performGet: function(hostName, path, responseCallback) {

      var headers = {
        'Content-Type': 'application/json',
        'X-API-KEY': apikey
      };

      var options = {
        host: hostName,
        path: path,
        method: 'GET',
        headers: headers
      };

      console.info("performing GET with host: "+hostName+", Path: "+path);

      https.request(options, function(response) {
        //console.log('STATUS: ' + response.statusCode);
        //console.log('HEADERS: ' + JSON.stringify(response.headers));
        response.setEncoding('utf8');

        var responseString = '';
        response.on('data', function (chunk) {
          //console.info(chunk);
          responseString += chunk;
        });

        response.on('end', function() {
          responseCallback(response.statusCode, responseString);
        });
      }).end();
  }
  }
}
