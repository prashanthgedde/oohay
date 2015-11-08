/**
 * Created by raghavachinnappa on 11/8/15.
 */
app.filter('mileFilter', function(){
  return function(kms){
    return parseInt(kms*0.000621371192);
  };
});