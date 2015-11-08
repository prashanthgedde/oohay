/**
 * Created by raghavachinnappa on 11/7/15.
 */

var opengraph = require('./opengraph.js');
var url = 'http://airport.globefeed.com/US_Nearest_Airport_Result.asp?lat=37.777390&lng=-122.416071';
opengraph.getHTML(url, function(html){
  console.info(opengraph.parse(html));
});
