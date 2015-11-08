/**
 * Created by raghavachinnappa on 11/7/15.
 */

var opengraph = require('./opengraph.js');
var url = 'http://airport.globefeed.com/US_Nearest_Airport_Result.asp?lat=37.54827&lng=-121.98857';
opengraph.getHTML({}, function(html){
  opengraph.parse(html);
});
