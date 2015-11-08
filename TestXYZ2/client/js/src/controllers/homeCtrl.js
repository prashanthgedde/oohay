app.controller('HomeCtrl', function($scope, uiGmapGoogleMapApi, $injector){
  var $mdDialog = $injector.get('$mdDialog'),
    XolaService = $injector.get('XolaService'),
    AirportService = $injector.get('AirportService'),
    $timeout = $injector.get('$timeout'),
    $log = $injector.get('$log'),
    $state = $injector.get('$state'),
    $rootScope = $injector.get('$rootScope');

  $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
  $scope.trip = {
    price: 100
  };

  uiGmapGoogleMapApi.then(function(maps) {
    //console.info(maps);
  });

  $rootScope.$on('SEARCH_CRITERIA', function(e, selectedCriteria){
    $rootScope.selectedCriteria = selectedCriteria;
    $state.go('search', {
      interests: selectedCriteria.interests.join(','),
      lat: selectedCriteria.airport.lat,
      lon: selectedCriteria.airport.lon
    });
  });

  $scope.start = function(ev){
    return $mdDialog.show({
      controller: function($scope, $mdDialog, $controller){
        $controller('DialogController', {
          '$scope': $scope,
          '$mdDialog': $mdDialog
        });
        $scope.selectedTab = 0;
        $scope.offers = [
          { price: '$250'},
          { price: '$350'},
          { price: '$500'},
          { price: '$750'},
          { price: '$1000'},
          { price: '> $1000'}
        ];

        var startDate = new Date();
        var endDate = new Date();
        endDate.setDate(endDate.getDate()+2);

        $scope.selected = {
          offer: {
            index: null
          },
          _interests: {},
          dates: {
            start: startDate,
            end: endDate
          },
          airport: {
            "airport_code": "SFO",
            "name": "San Francisco International",
            "place": "San Francisco, CA",
            "country": "United States",
            "country_code": "US",
            "lat": 37.618889,
            "long": -122.375
          }
        };

        $scope.selectOffer = function(index){
          $scope.selected.offer.index = index;
          $scope.selectedTab = 1;
        };

        $scope.interests = XolaService.fetch();

        $scope.next = function(){
          $scope.selectedTab++;
        };

        $scope.showToolbar = function(name){
          if(name === 'default'){
            return ($scope.selectedTab !== 2);
          } else if(name === 'final'){
            return ($scope.selectedTab === 2);
          }
        };

        $scope.search = function(){

          var newInteresets = []
          _.each($scope.selected._interests, function(item, index){
            if(String(item).toLowerCase() === 'true') {
              newInteresets.push($scope.interests[index]);
            }
          });

          $scope.selected.interests = newInteresets;
          $rootScope.$emit('SEARCH_CRITERIA', $scope.selected);
          $scope.cancel();
        };

        // list of `state` value/display objects
        $scope.simulateQuery = false;
        $scope.airports        = loadAll();
        $scope.querySearch   = querySearch;
        $scope.selectedItemChange = selectedItemChange;
        $scope.searchTextChange   = searchTextChange;
        $scope.getAirportName = getAirportName;

        function querySearch (query) {
          var results = query ? $scope.airports.filter( createFilterFor(query) ) : $scope.airports,
            deferred;
          if ($scope.simulateQuery) {
            deferred = $q.defer();
            $timeout(function () { deferred.resolve( results ); }, Math.random() * 1000, false);
            return deferred.promise;
          } else {
            return results;
          }
        }
        function searchTextChange(text) {
          $log.info('Text changed to ' + text);
        }
        function selectedItemChange(item) {
          $log.info('Item changed to ' + JSON.stringify(item));
        }
        /**
         * Build `states` list of key/value pairs
         */
        function loadAll() {
          return AirportService.fetch();
        }
        
        /**
         * Create filter function for a query string
         */
        function createFilterFor(query) {
          var lowercaseQuery = angular.lowercase(query);
          return function filterFn(airport) {
            return ((airport.airport_code.toLowerCase()).search(lowercaseQuery) > -1) || ((airport.name.toLowerCase()).search(lowercaseQuery) > -1);
          };
        }

        function getAirportName(item) {
          return item.airport_code+' / '+item.name+", "+item.country_code;
        }

      },
      locals: { price: $scope.trip.price },
      templateUrl: 'js/templates/start-modal.html',
      parent: angular.element(document.body),
      targetEvent: ev
    });
  }

});