app.controller('SearchCtrl', function($scope, $injector) {
  'use strict';

  var $state = $injector.get('$state'),
    $http = $injector.get('$http'),
    $rootScope = $injector.get('$rootScope');

  $scope.airports = {};
  $scope.deferred;
  $scope.results = [];
  $scope.total = 0;
  $scope.query = '';
  $scope.search = function() {
    var criteria = angular.copy($rootScope.selectedCriteria || {
        interests: [],
        airport: {
          lat: '',
          lon: ''
        }
      }),
      params = _.defaults(($state.params || {}), {
        interests: criteria.interests.join(','),
        lat: criteria.airport.lat,
        lon: criteria.airport.lon,
        radius: 6000,
        limit: 200
      }),
      url;

    if(params){
      url = angular.sprintf("/events?interests=%(interests)s&lat=%(lat)s&lon=%(lon)s&rad=%(radius)s&limit=%(limit)s", params);
      $http.get(url)
        .then(function(response){

          // filter the test data
          response.data = _.filter(response.data, function(item){
            var test = item.name.search(/test|asdf|adjustment|Title/i);
            return test === -1
          });

          // group by airport
          response.data = _.groupBy(response.data, function(item){
            $scope.airports[item.geo.airport.code] = item.geo;
            return item.geo.airport.code;
          });

          $scope.results = response.data;
        });

    } else {
      $state.go('home');
    }
  };

  $scope.image = function(url){
    if(url !== null) {
      return '//dev.xola.com' + url;
    } else {
      return '/img/default.jpg';
    }
  };

  $scope.getAirportDetails = function(airport_code){
    var airport = $scope.airports[airport_code].airport;
    return airport.name + " ("+airport.code + ")";
  };

  $scope.getValueInMiles = function(kms){
    return parseInt(kms*0.621371192);
  };

  $scope.search();
});