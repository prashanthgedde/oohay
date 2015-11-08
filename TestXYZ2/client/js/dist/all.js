var app = angular.module('App', [
  'lbServices', 'ui.router', 'sprintf', 'ngMaterial', 'md.data.table', 'mdDateTime', 'ngSanitize', 'uiGmapgoogle-maps'
])
  .constant('configService', function() {
    var servers = {
        'api': {
          'dev': 'http://localhost:3000/api',
          'production': 'http://ec2-54-164-100-208.compute-1.amazonaws.com:3000/api'
        },
        'image': {
          'dev': 'http://localhost:3030',
          'production': 'http://ec2-54-164-100-208.compute-1.amazonaws.com:3030'
        }
      }
      , ENV = 'dev';

    /**
     * get the server name
     * @param {String} type for the server
     * @return {String} URL of the server
     */
    this.get = function(type) {
      return servers[type][this.getEnv()];
    };

    /**
     * @return {String} dev / production environment
     */
    this.getEnv = function() {
      return ENV;
    };

    return this;
  }())

  .config(function(LoopBackResourceProvider, configService) {
    // Use a custom auth header instead of the default 'Authorization'
    LoopBackResourceProvider.setAuthHeader('X-Access-Token');

    // Change the URL where to access the LoopBack REST API server
    LoopBackResourceProvider.setUrlBase(configService.get('api'));
  })
  .config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
      .state('home', {
        url: '/home',
        templateUrl: 'js/templates/home.html',
        controller: 'HomeCtrl'
      })
      .state('search', {
        url: '/search/:lat/:lon/:interests',
        templateUrl: 'js/templates/search.html',
        controller: 'SearchCtrl'
      });

    // if none of the above states are matched, use this as the fallback
    $urlRouterProvider.otherwise('/home');
  })
  .config(function($mdThemingProvider, $mdIconProvider) {
    $mdThemingProvider.theme('default');

    $mdIconProvider
      .defaultIconSet('/bower_components/angular-material/demos/icon/demoSvgIconSets/assets/core-icons.svg', 24);

  })

  .run(function() {
    angular.sprintf = angular.sprintf || window.sprintf || function() { return arguments; };
  });

app.controller('DialogController', function($scope, $mdDialog) {
  'use strict';

  $scope.cancel = function() {
    $mdDialog.cancel();
  };
});
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
app.controller('workspaceCtrl', function($scope, $state) {
  'use strict';

  $scope.menu = [
    {
      title: 'Digests',
      icon: 'view_carousel',
      state: 'digests'
    },
    {
      title: 'Posts',
      icon: 'playlist_addd',
      state: 'posts'
    }
  ]

  $scope.leftSidenavOpen = false;
  $scope.toggleSidenav = function(){
    $scope.leftSidenavOpen = !$scope.leftSidenavOpen;
  }

  $scope.changeState = function(state){
    $state.go(state);
    $scope.toggleSidenav();
  }

});
app.directive("priceSelector", function() {
  return {
    require: "ngModel",
    scope: {
      price: '=ngModel'
    },
    templateUrl: 'js/templates/price-selector.html',
    link: function($scope) {

    }
  };
});
/**
 * Created by raghavachinnappa on 11/8/15.
 */
app.filter('mileFilter', function(){
  return function(kms){
    return parseInt(kms*0.000621371192);
  };
});
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

app.service('helper', function ($filter) {
  'use strict';
  var exports = {};

  exports.isDisplay = function(type){
    return (type === 'display');
  };

  exports.renderDateColumn = function (data, type) {
    return exports.isDisplay(type)? $filter('date', 'short')(data) : '';
  };

  exports.renderLinkColumn = function (data, type, full) {
    if(exports.isDisplay(type)){
      return angular.sprintf('<a href="#/posts/%(id)s" data-id="%(id)s">%(title)s</a>', {
        id: full.id,
        title: full.title
      });
    }
    return '';
  };

  exports.isArrayEqual = function(a, b) {
    return _.all(_.zip(a, b), function(x) {
      return x[0] === x[1];
    });
  };

  return exports;
});

(function(window, angular, undefined) {'use strict';

var urlBase = "/api";
var authHeader = 'authorization';

/**
 * @ngdoc overview
 * @name lbServices
 * @module
 * @description
 *
 * The `lbServices` module provides services for interacting with
 * the models exposed by the LoopBack server via the REST API.
 *
 */
var module = angular.module("lbServices", ['ngResource']);

/**
 * @ngdoc object
 * @name lbServices.User
 * @header lbServices.User
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `User` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "User",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/users/:id",
      { 'id': '@id' },
      {

        // INTERNAL. Use User.accessTokens.findById() instead.
        "prototype$__findById__accessTokens": {
          url: urlBase + "/users/:id/accessTokens/:fk",
          method: "GET"
        },

        // INTERNAL. Use User.accessTokens.destroyById() instead.
        "prototype$__destroyById__accessTokens": {
          url: urlBase + "/users/:id/accessTokens/:fk",
          method: "DELETE"
        },

        // INTERNAL. Use User.accessTokens.updateById() instead.
        "prototype$__updateById__accessTokens": {
          url: urlBase + "/users/:id/accessTokens/:fk",
          method: "PUT"
        },

        // INTERNAL. Use User.credentials.findById() instead.
        "prototype$__findById__credentials": {
          url: urlBase + "/users/:id/credentials/:fk",
          method: "GET"
        },

        // INTERNAL. Use User.credentials.destroyById() instead.
        "prototype$__destroyById__credentials": {
          url: urlBase + "/users/:id/credentials/:fk",
          method: "DELETE"
        },

        // INTERNAL. Use User.credentials.updateById() instead.
        "prototype$__updateById__credentials": {
          url: urlBase + "/users/:id/credentials/:fk",
          method: "PUT"
        },

        // INTERNAL. Use User.identities.findById() instead.
        "prototype$__findById__identities": {
          url: urlBase + "/users/:id/identities/:fk",
          method: "GET"
        },

        // INTERNAL. Use User.identities.destroyById() instead.
        "prototype$__destroyById__identities": {
          url: urlBase + "/users/:id/identities/:fk",
          method: "DELETE"
        },

        // INTERNAL. Use User.identities.updateById() instead.
        "prototype$__updateById__identities": {
          url: urlBase + "/users/:id/identities/:fk",
          method: "PUT"
        },

        // INTERNAL. Use User.accessTokens() instead.
        "prototype$__get__accessTokens": {
          isArray: true,
          url: urlBase + "/users/:id/accessTokens",
          method: "GET"
        },

        // INTERNAL. Use User.accessTokens.create() instead.
        "prototype$__create__accessTokens": {
          url: urlBase + "/users/:id/accessTokens",
          method: "POST"
        },

        // INTERNAL. Use User.accessTokens.destroyAll() instead.
        "prototype$__delete__accessTokens": {
          url: urlBase + "/users/:id/accessTokens",
          method: "DELETE"
        },

        // INTERNAL. Use User.accessTokens.count() instead.
        "prototype$__count__accessTokens": {
          url: urlBase + "/users/:id/accessTokens/count",
          method: "GET"
        },

        // INTERNAL. Use User.credentials() instead.
        "prototype$__get__credentials": {
          isArray: true,
          url: urlBase + "/users/:id/credentials",
          method: "GET"
        },

        // INTERNAL. Use User.credentials.create() instead.
        "prototype$__create__credentials": {
          url: urlBase + "/users/:id/credentials",
          method: "POST"
        },

        // INTERNAL. Use User.credentials.destroyAll() instead.
        "prototype$__delete__credentials": {
          url: urlBase + "/users/:id/credentials",
          method: "DELETE"
        },

        // INTERNAL. Use User.credentials.count() instead.
        "prototype$__count__credentials": {
          url: urlBase + "/users/:id/credentials/count",
          method: "GET"
        },

        // INTERNAL. Use User.identities() instead.
        "prototype$__get__identities": {
          isArray: true,
          url: urlBase + "/users/:id/identities",
          method: "GET"
        },

        // INTERNAL. Use User.identities.create() instead.
        "prototype$__create__identities": {
          url: urlBase + "/users/:id/identities",
          method: "POST"
        },

        // INTERNAL. Use User.identities.destroyAll() instead.
        "prototype$__delete__identities": {
          url: urlBase + "/users/:id/identities",
          method: "DELETE"
        },

        // INTERNAL. Use User.identities.count() instead.
        "prototype$__count__identities": {
          url: urlBase + "/users/:id/identities/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#create
         * @methodOf lbServices.User
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/users",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#upsert
         * @methodOf lbServices.User
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/users",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#exists
         * @methodOf lbServices.User
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/users/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#findById
         * @methodOf lbServices.User
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/users/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#find
         * @methodOf lbServices.User
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/users",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#findOne
         * @methodOf lbServices.User
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/users/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#updateAll
         * @methodOf lbServices.User
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/users/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#deleteById
         * @methodOf lbServices.User
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/users/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#count
         * @methodOf lbServices.User
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/users/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#prototype$updateAttributes
         * @methodOf lbServices.User
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/users/:id",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#login
         * @methodOf lbServices.User
         *
         * @description
         *
         * Login a user with username/email and password.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `include` – `{string=}` - Related objects to include in the response. See the description of return value for more details.
         *   Default value: `user`.
         *
         *  - `rememberMe` - `boolean` - Whether the authentication credentials
         *     should be remembered in localStorage across app/browser restarts.
         *     Default: `true`.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * The response body contains properties of the AccessToken created on login.
         * Depending on the value of `include` parameter, the body may contain additional properties:
         * 
         *   - `user` - `{User}` - Data of the currently logged in user. (`include=user`)
         * 
         *
         */
        "login": {
          params: {
            include: "user"
          },
          interceptor: {
            response: function(response) {
              var accessToken = response.data;
              LoopBackAuth.setUser(accessToken.id, accessToken.userId, accessToken.user);
              LoopBackAuth.rememberMe = response.config.params.rememberMe !== false;
              LoopBackAuth.save();
              return response.resource;
            }
          },
          url: urlBase + "/users/login",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#logout
         * @methodOf lbServices.User
         *
         * @description
         *
         * Logout a user with access token
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         *  - `access_token` – `{string}` - Do not supply this argument, it is automatically extracted from request headers.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "logout": {
          interceptor: {
            response: function(response) {
              LoopBackAuth.clearUser();
              LoopBackAuth.clearStorage();
              return response.resource;
            }
          },
          url: urlBase + "/users/logout",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#confirm
         * @methodOf lbServices.User
         *
         * @description
         *
         * Confirm a user registration with email verification token
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `uid` – `{string}` - 
         *
         *  - `token` – `{string}` - 
         *
         *  - `redirect` – `{string=}` - 
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "confirm": {
          url: urlBase + "/users/confirm",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#resetPassword
         * @methodOf lbServices.User
         *
         * @description
         *
         * Reset password for a user with email
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "resetPassword": {
          url: urlBase + "/users/reset",
          method: "POST"
        },

        // INTERNAL. Use AccessToken.user() instead.
        "::get::accessToken::user": {
          url: urlBase + "/accessTokens/:id/user",
          method: "GET"
        },

        // INTERNAL. Use UserCredential.user() instead.
        "::get::userCredential::user": {
          url: urlBase + "/userCredentials/:id/user",
          method: "GET"
        },

        // INTERNAL. Use UserIdentity.user() instead.
        "::get::userIdentity::user": {
          url: urlBase + "/userIdentities/:id/user",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.User#getCurrent
         * @methodOf lbServices.User
         *
         * @description
         *
         * Get data of the currently logged user. Fail with HTTP result 401
         * when there is no user logged in.
         *
         * @param {function(Object,Object)=} successCb
         *    Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *    `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         */
        "getCurrent": {
           url: urlBase + "/users" + "/:id",
           method: "GET",
           params: {
             id: function() {
              var id = LoopBackAuth.currentUserId;
              if (id == null) id = '__anonymous__';
              return id;
            },
          },
          interceptor: {
            response: function(response) {
              LoopBackAuth.currentUserData = response.data;
              return response.resource;
            }
          },
          __isGetCurrentUser__ : true
        }
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.User#updateOrCreate
         * @methodOf lbServices.User
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.User#update
         * @methodOf lbServices.User
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.User#destroyById
         * @methodOf lbServices.User
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.User#removeById
         * @methodOf lbServices.User
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.User#getCachedCurrent
         * @methodOf lbServices.User
         *
         * @description
         *
         * Get data of the currently logged user that was returned by the last
         * call to {@link lbServices.User#login} or
         * {@link lbServices.User#getCurrent}. Return null when there
         * is no user logged in or the data of the current user were not fetched
         * yet.
         *
         * @returns {Object} A User instance.
         */
        R.getCachedCurrent = function() {
          var data = LoopBackAuth.currentUserData;
          return data ? new R(data) : null;
        };

        /**
         * @ngdoc method
         * @name lbServices.User#isAuthenticated
         * @methodOf lbServices.User
         *
         * @returns {boolean} True if the current user is authenticated (logged in).
         */
        R.isAuthenticated = function() {
          return this.getCurrentId() != null;
        };

        /**
         * @ngdoc method
         * @name lbServices.User#getCurrentId
         * @methodOf lbServices.User
         *
         * @returns {Object} Id of the currently logged-in user or null.
         */
        R.getCurrentId = function() {
          return LoopBackAuth.currentUserId;
        };

    /**
    * @ngdoc property
    * @name lbServices.User#modelName
    * @propertyOf lbServices.User
    * @description
    * The name of the model represented by this $resource,
    * i.e. `User`.
    */
    R.modelName = "User";

    /**
     * @ngdoc object
     * @name lbServices.User.accessTokens
     * @header lbServices.User.accessTokens
     * @object
     * @description
     *
     * The object `User.accessTokens` groups methods
     * manipulating `AccessToken` instances related to `User`.
     *
     * Call {@link lbServices.User#accessTokens User.accessTokens()}
     * to query all related instances.
     */


        /**
         * @ngdoc method
         * @name lbServices.User#accessTokens
         * @methodOf lbServices.User
         *
         * @description
         *
         * Queries accessTokens of user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `filter` – `{object=}` - 
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        R.accessTokens = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::get::user::accessTokens"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.accessTokens#count
         * @methodOf lbServices.User.accessTokens
         *
         * @description
         *
         * Counts accessTokens of user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        R.accessTokens.count = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::count::user::accessTokens"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.accessTokens#create
         * @methodOf lbServices.User.accessTokens
         *
         * @description
         *
         * Creates a new instance in accessTokens of this model.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        R.accessTokens.create = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::create::user::accessTokens"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.accessTokens#destroyAll
         * @methodOf lbServices.User.accessTokens
         *
         * @description
         *
         * Deletes all accessTokens of this model.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R.accessTokens.destroyAll = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::delete::user::accessTokens"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.accessTokens#destroyById
         * @methodOf lbServices.User.accessTokens
         *
         * @description
         *
         * Delete a related item by id for accessTokens.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for accessTokens
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R.accessTokens.destroyById = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::destroyById::user::accessTokens"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.accessTokens#findById
         * @methodOf lbServices.User.accessTokens
         *
         * @description
         *
         * Find a related item by id for accessTokens.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for accessTokens
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        R.accessTokens.findById = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::findById::user::accessTokens"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.accessTokens#updateById
         * @methodOf lbServices.User.accessTokens
         *
         * @description
         *
         * Update a related item by id for accessTokens.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for accessTokens
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        R.accessTokens.updateById = function() {
          var TargetResource = $injector.get("AccessToken");
          var action = TargetResource["::updateById::user::accessTokens"];
          return action.apply(R, arguments);
        };
    /**
     * @ngdoc object
     * @name lbServices.User.credentials
     * @header lbServices.User.credentials
     * @object
     * @description
     *
     * The object `User.credentials` groups methods
     * manipulating `UserCredential` instances related to `User`.
     *
     * Call {@link lbServices.User#credentials User.credentials()}
     * to query all related instances.
     */


        /**
         * @ngdoc method
         * @name lbServices.User#credentials
         * @methodOf lbServices.User
         *
         * @description
         *
         * Queries credentials of user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `filter` – `{object=}` - 
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        R.credentials = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::get::user::credentials"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.credentials#count
         * @methodOf lbServices.User.credentials
         *
         * @description
         *
         * Counts credentials of user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        R.credentials.count = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::count::user::credentials"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.credentials#create
         * @methodOf lbServices.User.credentials
         *
         * @description
         *
         * Creates a new instance in credentials of this model.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        R.credentials.create = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::create::user::credentials"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.credentials#destroyAll
         * @methodOf lbServices.User.credentials
         *
         * @description
         *
         * Deletes all credentials of this model.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R.credentials.destroyAll = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::delete::user::credentials"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.credentials#destroyById
         * @methodOf lbServices.User.credentials
         *
         * @description
         *
         * Delete a related item by id for credentials.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for credentials
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R.credentials.destroyById = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::destroyById::user::credentials"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.credentials#findById
         * @methodOf lbServices.User.credentials
         *
         * @description
         *
         * Find a related item by id for credentials.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for credentials
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        R.credentials.findById = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::findById::user::credentials"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.credentials#updateById
         * @methodOf lbServices.User.credentials
         *
         * @description
         *
         * Update a related item by id for credentials.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for credentials
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        R.credentials.updateById = function() {
          var TargetResource = $injector.get("UserCredential");
          var action = TargetResource["::updateById::user::credentials"];
          return action.apply(R, arguments);
        };
    /**
     * @ngdoc object
     * @name lbServices.User.identities
     * @header lbServices.User.identities
     * @object
     * @description
     *
     * The object `User.identities` groups methods
     * manipulating `UserIdentity` instances related to `User`.
     *
     * Call {@link lbServices.User#identities User.identities()}
     * to query all related instances.
     */


        /**
         * @ngdoc method
         * @name lbServices.User#identities
         * @methodOf lbServices.User
         *
         * @description
         *
         * Queries identities of user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `filter` – `{object=}` - 
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        R.identities = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::get::user::identities"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.identities#count
         * @methodOf lbServices.User.identities
         *
         * @description
         *
         * Counts identities of user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        R.identities.count = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::count::user::identities"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.identities#create
         * @methodOf lbServices.User.identities
         *
         * @description
         *
         * Creates a new instance in identities of this model.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        R.identities.create = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::create::user::identities"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.identities#destroyAll
         * @methodOf lbServices.User.identities
         *
         * @description
         *
         * Deletes all identities of this model.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R.identities.destroyAll = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::delete::user::identities"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.identities#destroyById
         * @methodOf lbServices.User.identities
         *
         * @description
         *
         * Delete a related item by id for identities.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for identities
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R.identities.destroyById = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::destroyById::user::identities"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.identities#findById
         * @methodOf lbServices.User.identities
         *
         * @description
         *
         * Find a related item by id for identities.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for identities
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        R.identities.findById = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::findById::user::identities"];
          return action.apply(R, arguments);
        };

        /**
         * @ngdoc method
         * @name lbServices.User.identities#updateById
         * @methodOf lbServices.User.identities
         *
         * @description
         *
         * Update a related item by id for identities.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - User id
         *
         *  - `fk` – `{*}` - Foreign key for identities
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        R.identities.updateById = function() {
          var TargetResource = $injector.get("UserIdentity");
          var action = TargetResource["::updateById::user::identities"];
          return action.apply(R, arguments);
        };

    return R;
  }]);

/**
 * @ngdoc object
 * @name lbServices.AccessToken
 * @header lbServices.AccessToken
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `AccessToken` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "AccessToken",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/accessTokens/:id",
      { 'id': '@id' },
      {

        // INTERNAL. Use AccessToken.user() instead.
        "prototype$__get__user": {
          url: urlBase + "/accessTokens/:id/user",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#create
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/accessTokens",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#upsert
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/accessTokens",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#exists
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/accessTokens/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#findById
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/accessTokens/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#find
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/accessTokens",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#findOne
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/accessTokens/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#updateAll
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/accessTokens/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#deleteById
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/accessTokens/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#count
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/accessTokens/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#prototype$updateAttributes
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - AccessToken id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/accessTokens/:id",
          method: "PUT"
        },

        // INTERNAL. Use User.accessTokens.findById() instead.
        "::findById::user::accessTokens": {
          url: urlBase + "/users/:id/accessTokens/:fk",
          method: "GET"
        },

        // INTERNAL. Use User.accessTokens.destroyById() instead.
        "::destroyById::user::accessTokens": {
          url: urlBase + "/users/:id/accessTokens/:fk",
          method: "DELETE"
        },

        // INTERNAL. Use User.accessTokens.updateById() instead.
        "::updateById::user::accessTokens": {
          url: urlBase + "/users/:id/accessTokens/:fk",
          method: "PUT"
        },

        // INTERNAL. Use User.accessTokens() instead.
        "::get::user::accessTokens": {
          isArray: true,
          url: urlBase + "/users/:id/accessTokens",
          method: "GET"
        },

        // INTERNAL. Use User.accessTokens.create() instead.
        "::create::user::accessTokens": {
          url: urlBase + "/users/:id/accessTokens",
          method: "POST"
        },

        // INTERNAL. Use User.accessTokens.destroyAll() instead.
        "::delete::user::accessTokens": {
          url: urlBase + "/users/:id/accessTokens",
          method: "DELETE"
        },

        // INTERNAL. Use User.accessTokens.count() instead.
        "::count::user::accessTokens": {
          url: urlBase + "/users/:id/accessTokens/count",
          method: "GET"
        },
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.AccessToken#updateOrCreate
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `AccessToken` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#update
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#destroyById
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.AccessToken#removeById
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];


    /**
    * @ngdoc property
    * @name lbServices.AccessToken#modelName
    * @propertyOf lbServices.AccessToken
    * @description
    * The name of the model represented by this $resource,
    * i.e. `AccessToken`.
    */
    R.modelName = "AccessToken";


        /**
         * @ngdoc method
         * @name lbServices.AccessToken#user
         * @methodOf lbServices.AccessToken
         *
         * @description
         *
         * Fetches belongsTo relation user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - AccessToken id
         *
         *  - `refresh` – `{boolean=}` - 
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        R.user = function() {
          var TargetResource = $injector.get("User");
          var action = TargetResource["::get::accessToken::user"];
          return action.apply(R, arguments);
        };

    return R;
  }]);

/**
 * @ngdoc object
 * @name lbServices.UserCredential
 * @header lbServices.UserCredential
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `UserCredential` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "UserCredential",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/userCredentials/:id",
      { 'id': '@id' },
      {

        // INTERNAL. Use UserCredential.user() instead.
        "prototype$__get__user": {
          url: urlBase + "/userCredentials/:id/user",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#create
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/userCredentials",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#upsert
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/userCredentials",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#exists
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/userCredentials/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#findById
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/userCredentials/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#find
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/userCredentials",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#findOne
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/userCredentials/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#updateAll
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/userCredentials/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#deleteById
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/userCredentials/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#count
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/userCredentials/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#prototype$updateAttributes
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - UserCredential id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/userCredentials/:id",
          method: "PUT"
        },

        // INTERNAL. Use User.credentials.findById() instead.
        "::findById::user::credentials": {
          url: urlBase + "/users/:id/credentials/:fk",
          method: "GET"
        },

        // INTERNAL. Use User.credentials.destroyById() instead.
        "::destroyById::user::credentials": {
          url: urlBase + "/users/:id/credentials/:fk",
          method: "DELETE"
        },

        // INTERNAL. Use User.credentials.updateById() instead.
        "::updateById::user::credentials": {
          url: urlBase + "/users/:id/credentials/:fk",
          method: "PUT"
        },

        // INTERNAL. Use User.credentials() instead.
        "::get::user::credentials": {
          isArray: true,
          url: urlBase + "/users/:id/credentials",
          method: "GET"
        },

        // INTERNAL. Use User.credentials.create() instead.
        "::create::user::credentials": {
          url: urlBase + "/users/:id/credentials",
          method: "POST"
        },

        // INTERNAL. Use User.credentials.destroyAll() instead.
        "::delete::user::credentials": {
          url: urlBase + "/users/:id/credentials",
          method: "DELETE"
        },

        // INTERNAL. Use User.credentials.count() instead.
        "::count::user::credentials": {
          url: urlBase + "/users/:id/credentials/count",
          method: "GET"
        },
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.UserCredential#updateOrCreate
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserCredential` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#update
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#destroyById
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.UserCredential#removeById
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];


    /**
    * @ngdoc property
    * @name lbServices.UserCredential#modelName
    * @propertyOf lbServices.UserCredential
    * @description
    * The name of the model represented by this $resource,
    * i.e. `UserCredential`.
    */
    R.modelName = "UserCredential";


        /**
         * @ngdoc method
         * @name lbServices.UserCredential#user
         * @methodOf lbServices.UserCredential
         *
         * @description
         *
         * Fetches belongsTo relation user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - UserCredential id
         *
         *  - `refresh` – `{boolean=}` - 
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        R.user = function() {
          var TargetResource = $injector.get("User");
          var action = TargetResource["::get::userCredential::user"];
          return action.apply(R, arguments);
        };

    return R;
  }]);

/**
 * @ngdoc object
 * @name lbServices.UserIdentity
 * @header lbServices.UserIdentity
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `UserIdentity` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "UserIdentity",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/userIdentities/:id",
      { 'id': '@id' },
      {

        // INTERNAL. Use UserIdentity.user() instead.
        "prototype$__get__user": {
          url: urlBase + "/userIdentities/:id/user",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#create
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/userIdentities",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#upsert
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/userIdentities",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#exists
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/userIdentities/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#findById
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/userIdentities/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#find
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/userIdentities",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#findOne
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/userIdentities/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#updateAll
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/userIdentities/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#deleteById
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/userIdentities/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#count
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/userIdentities/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#prototype$updateAttributes
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - UserIdentity id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/userIdentities/:id",
          method: "PUT"
        },

        // INTERNAL. Use User.identities.findById() instead.
        "::findById::user::identities": {
          url: urlBase + "/users/:id/identities/:fk",
          method: "GET"
        },

        // INTERNAL. Use User.identities.destroyById() instead.
        "::destroyById::user::identities": {
          url: urlBase + "/users/:id/identities/:fk",
          method: "DELETE"
        },

        // INTERNAL. Use User.identities.updateById() instead.
        "::updateById::user::identities": {
          url: urlBase + "/users/:id/identities/:fk",
          method: "PUT"
        },

        // INTERNAL. Use User.identities() instead.
        "::get::user::identities": {
          isArray: true,
          url: urlBase + "/users/:id/identities",
          method: "GET"
        },

        // INTERNAL. Use User.identities.create() instead.
        "::create::user::identities": {
          url: urlBase + "/users/:id/identities",
          method: "POST"
        },

        // INTERNAL. Use User.identities.destroyAll() instead.
        "::delete::user::identities": {
          url: urlBase + "/users/:id/identities",
          method: "DELETE"
        },

        // INTERNAL. Use User.identities.count() instead.
        "::count::user::identities": {
          url: urlBase + "/users/:id/identities/count",
          method: "GET"
        },
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#updateOrCreate
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `UserIdentity` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#update
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#destroyById
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#removeById
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];


    /**
    * @ngdoc property
    * @name lbServices.UserIdentity#modelName
    * @propertyOf lbServices.UserIdentity
    * @description
    * The name of the model represented by this $resource,
    * i.e. `UserIdentity`.
    */
    R.modelName = "UserIdentity";


        /**
         * @ngdoc method
         * @name lbServices.UserIdentity#user
         * @methodOf lbServices.UserIdentity
         *
         * @description
         *
         * Fetches belongsTo relation user.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - UserIdentity id
         *
         *  - `refresh` – `{boolean=}` - 
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `User` object.)
         * </em>
         */
        R.user = function() {
          var TargetResource = $injector.get("User");
          var action = TargetResource["::get::userIdentity::user"];
          return action.apply(R, arguments);
        };

    return R;
  }]);

/**
 * @ngdoc object
 * @name lbServices.Post
 * @header lbServices.Post
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `Post` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "Post",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/posts/:id",
      { 'id': '@id' },
      {

        /**
         * @ngdoc method
         * @name lbServices.Post#create
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/posts",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#upsert
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/posts",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#exists
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/posts/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#findById
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/posts/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#find
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/posts",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#findOne
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/posts/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#updateAll
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/posts/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#deleteById
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/posts/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#count
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/posts/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Post#prototype$updateAttributes
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - PersistedModel id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/posts/:id",
          method: "PUT"
        },
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.Post#updateOrCreate
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Post` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.Post#update
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.Post#destroyById
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.Post#removeById
         * @methodOf lbServices.Post
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];


    /**
    * @ngdoc property
    * @name lbServices.Post#modelName
    * @propertyOf lbServices.Post
    * @description
    * The name of the model represented by this $resource,
    * i.e. `Post`.
    */
    R.modelName = "Post";


    return R;
  }]);

/**
 * @ngdoc object
 * @name lbServices.Image
 * @header lbServices.Image
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `Image` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "Image",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/images/:id",
      { 'id': '@id' },
      {

        /**
         * @ngdoc method
         * @name lbServices.Image#create
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/images",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#upsert
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/images",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#exists
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/images/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#findById
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/images/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#find
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/images",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#findOne
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/images/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#updateAll
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/images/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#deleteById
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/images/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#count
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/images/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Image#prototype$updateAttributes
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - PersistedModel id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/images/:id",
          method: "PUT"
        },
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.Image#updateOrCreate
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Image` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.Image#update
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.Image#destroyById
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.Image#removeById
         * @methodOf lbServices.Image
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];


    /**
    * @ngdoc property
    * @name lbServices.Image#modelName
    * @propertyOf lbServices.Image
    * @description
    * The name of the model represented by this $resource,
    * i.e. `Image`.
    */
    R.modelName = "Image";


    return R;
  }]);

/**
 * @ngdoc object
 * @name lbServices.Digest
 * @header lbServices.Digest
 * @object
 *
 * @description
 *
 * A $resource object for interacting with the `Digest` model.
 *
 * ## Example
 *
 * See
 * {@link http://docs.angularjs.org/api/ngResource.$resource#example $resource}
 * for an example of using this object.
 *
 */
module.factory(
  "Digest",
  ['LoopBackResource', 'LoopBackAuth', '$injector', function(Resource, LoopBackAuth, $injector) {
    var R = Resource(
      urlBase + "/digests/:id",
      { 'id': '@id' },
      {

        /**
         * @ngdoc method
         * @name lbServices.Digest#create
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Create a new instance of the model and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        "create": {
          url: urlBase + "/digests",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#upsert
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        "upsert": {
          url: urlBase + "/digests",
          method: "PUT"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#exists
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Check whether a model instance exists in the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `exists` – `{boolean=}` - 
         */
        "exists": {
          url: urlBase + "/digests/:id/exists",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#findById
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Find a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         *  - `filter` – `{object=}` - Filter defining fields and include
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        "findById": {
          url: urlBase + "/digests/:id",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#find
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Find all instances of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Array.<Object>,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Array.<Object>} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        "find": {
          isArray: true,
          url: urlBase + "/digests",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#findOne
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Find first instance of the model matched by filter from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `filter` – `{object=}` - Filter defining fields, where, include, order, offset, and limit
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        "findOne": {
          url: urlBase + "/digests/findOne",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#updateAll
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "updateAll": {
          url: urlBase + "/digests/update",
          method: "POST"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#deleteById
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        "deleteById": {
          url: urlBase + "/digests/:id",
          method: "DELETE"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#count
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Count instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * Data properties:
         *
         *  - `count` – `{number=}` - 
         */
        "count": {
          url: urlBase + "/digests/count",
          method: "GET"
        },

        /**
         * @ngdoc method
         * @name lbServices.Digest#prototype$updateAttributes
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Update attributes for a model instance and persist it into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - PersistedModel id
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        "prototype$updateAttributes": {
          url: urlBase + "/digests/:id",
          method: "PUT"
        },
      }
    );



        /**
         * @ngdoc method
         * @name lbServices.Digest#updateOrCreate
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Update an existing model instance or insert a new one into the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *   This method does not accept any parameters.
         *   Supply an empty object or omit this argument altogether.
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * <em>
         * (The remote method definition does not provide any description.
         * This usually means the response is a `Digest` object.)
         * </em>
         */
        R["updateOrCreate"] = R["upsert"];

        /**
         * @ngdoc method
         * @name lbServices.Digest#update
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Update instances of the model matched by where from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `where` – `{object=}` - Criteria to match model instances
         *
         * @param {Object} postData Request data.
         *
         * This method expects a subset of model properties as request parameters.
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["update"] = R["updateAll"];

        /**
         * @ngdoc method
         * @name lbServices.Digest#destroyById
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["destroyById"] = R["deleteById"];

        /**
         * @ngdoc method
         * @name lbServices.Digest#removeById
         * @methodOf lbServices.Digest
         *
         * @description
         *
         * Delete a model instance by id from the data source.
         *
         * @param {Object=} parameters Request parameters.
         *
         *  - `id` – `{*}` - Model id
         *
         * @param {function(Object,Object)=} successCb
         *   Success callback with two arguments: `value`, `responseHeaders`.
         *
         * @param {function(Object)=} errorCb Error callback with one argument:
         *   `httpResponse`.
         *
         * @returns {Object} An empty reference that will be
         *   populated with the actual data once the response is returned
         *   from the server.
         *
         * This method returns no data.
         */
        R["removeById"] = R["deleteById"];


    /**
    * @ngdoc property
    * @name lbServices.Digest#modelName
    * @propertyOf lbServices.Digest
    * @description
    * The name of the model represented by this $resource,
    * i.e. `Digest`.
    */
    R.modelName = "Digest";


    return R;
  }]);


module
  .factory('LoopBackAuth', function() {
    var props = ['accessTokenId', 'currentUserId'];
    var propsPrefix = '$LoopBack$';

    function LoopBackAuth() {
      var self = this;
      props.forEach(function(name) {
        self[name] = load(name);
      });
      this.rememberMe = undefined;
      this.currentUserData = null;
    }

    LoopBackAuth.prototype.save = function() {
      var self = this;
      var storage = this.rememberMe ? localStorage : sessionStorage;
      props.forEach(function(name) {
        save(storage, name, self[name]);
      });
    };

    LoopBackAuth.prototype.setUser = function(accessTokenId, userId, userData) {
      this.accessTokenId = accessTokenId;
      this.currentUserId = userId;
      this.currentUserData = userData;
    }

    LoopBackAuth.prototype.clearUser = function() {
      this.accessTokenId = null;
      this.currentUserId = null;
      this.currentUserData = null;
    }

    LoopBackAuth.prototype.clearStorage = function() {
      props.forEach(function(name) {
        save(sessionStorage, name, null);
        save(localStorage, name, null);
      });
    };

    return new LoopBackAuth();

    // Note: LocalStorage converts the value to string
    // We are using empty string as a marker for null/undefined values.
    function save(storage, name, value) {
      var key = propsPrefix + name;
      if (value == null) value = '';
      storage[key] = value;
    }

    function load(name) {
      var key = propsPrefix + name;
      return localStorage[key] || sessionStorage[key] || null;
    }
  })
  .config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push('LoopBackAuthRequestInterceptor');
  }])
  .factory('LoopBackAuthRequestInterceptor', [ '$q', 'LoopBackAuth',
    function($q, LoopBackAuth) {
      return {
        'request': function(config) {

          // filter out non urlBase requests
          if (config.url.substr(0, urlBase.length) !== urlBase) {
            return config;
          }

          if (LoopBackAuth.accessTokenId) {
            config.headers[authHeader] = LoopBackAuth.accessTokenId;
          } else if (config.__isGetCurrentUser__) {
            // Return a stub 401 error for User.getCurrent() when
            // there is no user logged in
            var res = {
              body: { error: { status: 401 } },
              status: 401,
              config: config,
              headers: function() { return undefined; }
            };
            return $q.reject(res);
          }
          return config || $q.when(config);
        }
      }
    }])

  /**
   * @ngdoc object
   * @name lbServices.LoopBackResourceProvider
   * @header lbServices.LoopBackResourceProvider
   * @description
   * Use `LoopBackResourceProvider` to change the global configuration
   * settings used by all models. Note that the provider is available
   * to Configuration Blocks only, see
   * {@link https://docs.angularjs.org/guide/module#module-loading-dependencies Module Loading & Dependencies}
   * for more details.
   *
   * ## Example
   *
   * ```js
   * angular.module('app')
   *  .config(function(LoopBackResourceProvider) {
   *     LoopBackResourceProvider.setAuthHeader('X-Access-Token');
   *  });
   * ```
   */
  .provider('LoopBackResource', function LoopBackResourceProvider() {
    /**
     * @ngdoc method
     * @name lbServices.LoopBackResourceProvider#setAuthHeader
     * @methodOf lbServices.LoopBackResourceProvider
     * @param {string} header The header name to use, e.g. `X-Access-Token`
     * @description
     * Configure the REST transport to use a different header for sending
     * the authentication token. It is sent in the `Authorization` header
     * by default.
     */
    this.setAuthHeader = function(header) {
      authHeader = header;
    };

    /**
     * @ngdoc method
     * @name lbServices.LoopBackResourceProvider#setUrlBase
     * @methodOf lbServices.LoopBackResourceProvider
     * @param {string} url The URL to use, e.g. `/api` or `//example.com/api`.
     * @description
     * Change the URL of the REST API server. By default, the URL provided
     * to the code generator (`lb-ng` or `grunt-loopback-sdk-angular`) is used.
     */
    this.setUrlBase = function(url) {
      urlBase = url;
    };

    this.$get = ['$resource', function($resource) {
      return function(url, params, actions) {
        var resource = $resource(url, params, actions);

        // Angular always calls POST on $save()
        // This hack is based on
        // http://kirkbushell.me/angular-js-using-ng-resource-in-a-more-restful-manner/
        resource.prototype.$save = function(success, error) {
          // Fortunately, LoopBack provides a convenient `upsert` method
          // that exactly fits our needs.
          var result = resource.upsert.call(this, {}, this, success, error);
          return result.$promise || result;
        };
        return resource;
      };
    }];
  });

})(window, window.angular);

app.service('XolaService', function($injector) {
  'use strict';

  var events = [
    "Action Sports Training",
    "Aerial Tours",
    "Archaeology",
    "Art & Architecture",
    "Backpacking/Camping",
    "Ballooning",
    "Beer Tour",
    "Birdwatching",
    "Bungee Jumping",
    "Canyoning",
    "Caving / Spelunking",
    "Creative Classes",
    "Cross Country Skiing",
    "Culture & History",
    "Cycling & Mountain Biking",
    "Deep Sea Fishing",
    "Dog Sledding",
    "Eco-Tour/Hike",
    "Film Screening",
    "Fly Fishing",
    "Food & Wine",
    "Gliders",
    "Guide School",
    "Hang Gliding ",
    "Heli-skiing",
    "Helicopter Tours",
    "Horseback Riding",
    "Houseboats",
    "Kayaking & Canoeing",
    "Lake Fishing",
    "Marine Wildlife",
    "Motor Yacht",
    "Mountaineering",
    "Music/Rafting festival",
    "Ocean Cruises",
    "Off-road",
    "Parachuting",
    "Paragliding",
    "Photography",
    "Private Jet Tours",
    "River Cruises",
    "River Rafting",
    "River Tubing ",
    "Rock Climbing",
    "Safety Training",
    "Sailing",
    "Scuba & Snorkeling",
    "Ski Tours",
    "Skiing ",
    "Skydiving",
    "Sleigh Riding",
    "Snow Tubing",
    "Snowcat Skiing",
    "Snowkiting",
    "Snowmobiling",
    "Snowshoeing",
    "Stand Up Paddle (SUP)",
    "Surfing",
    "Team Building",
    "Tourism & Technology Summit",
    "Trekking / Hiking",
    "Volunteering",
    "Wakeboarding",
    "Walking Tours",
    "Website Creation",
    "Wilderness Training",
    "Wildlife Safaris",
    "Windsurfing & Kitesurfing",
    "Zip-lining"
  ];

  var exports = {};
  exports.fetch = function(){
    return events;
  };


  return exports;
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImNvbnRyb2xsZXJzL2RpYWxvZ0N0cmwuanMiLCJjb250cm9sbGVycy9ob21lQ3RybC5qcyIsImNvbnRyb2xsZXJzL3NlYXJjaEN0cmwuanMiLCJjb250cm9sbGVycy93b3Jrc3BhY2VDdHJsLmpzIiwiZGlyZWN0aXZlcy9wcmljZS1zZWxlY3Rvci5qcyIsImZpbHRlcnMvbWlsZUZpbHRlci5qcyIsInNlcnZpY2VzL2FpcnBvcnRTZXJ2aWNlLmpzIiwic2VydmljZXMvaGVscGVyU2VydmljZS5qcyIsInNlcnZpY2VzL2xiLXNlcnZpY2VzLmpzIiwic2VydmljZXMveG9sYVNlcnZpY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdmlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiYWxsLmpzIiwic291cmNlc0NvbnRlbnQiOlsidmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdBcHAnLCBbXG4gICdsYlNlcnZpY2VzJywgJ3VpLnJvdXRlcicsICdzcHJpbnRmJywgJ25nTWF0ZXJpYWwnLCAnbWQuZGF0YS50YWJsZScsICdtZERhdGVUaW1lJywgJ25nU2FuaXRpemUnLCAndWlHbWFwZ29vZ2xlLW1hcHMnXG5dKVxuICAuY29uc3RhbnQoJ2NvbmZpZ1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VydmVycyA9IHtcbiAgICAgICAgJ2FwaSc6IHtcbiAgICAgICAgICAnZGV2JzogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hcGknLFxuICAgICAgICAgICdwcm9kdWN0aW9uJzogJ2h0dHA6Ly9lYzItNTQtMTY0LTEwMC0yMDguY29tcHV0ZS0xLmFtYXpvbmF3cy5jb206MzAwMC9hcGknXG4gICAgICAgIH0sXG4gICAgICAgICdpbWFnZSc6IHtcbiAgICAgICAgICAnZGV2JzogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAzMCcsXG4gICAgICAgICAgJ3Byb2R1Y3Rpb24nOiAnaHR0cDovL2VjMi01NC0xNjQtMTAwLTIwOC5jb21wdXRlLTEuYW1hem9uYXdzLmNvbTozMDMwJ1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAsIEVOViA9ICdkZXYnO1xuXG4gICAgLyoqXG4gICAgICogZ2V0IHRoZSBzZXJ2ZXIgbmFtZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIGZvciB0aGUgc2VydmVyXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBVUkwgb2YgdGhlIHNlcnZlclxuICAgICAqL1xuICAgIHRoaXMuZ2V0ID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgcmV0dXJuIHNlcnZlcnNbdHlwZV1bdGhpcy5nZXRFbnYoKV07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gZGV2IC8gcHJvZHVjdGlvbiBlbnZpcm9ubWVudFxuICAgICAqL1xuICAgIHRoaXMuZ2V0RW52ID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRU5WO1xuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSgpKVxuXG4gIC5jb25maWcoZnVuY3Rpb24oTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyLCBjb25maWdTZXJ2aWNlKSB7XG4gICAgLy8gVXNlIGEgY3VzdG9tIGF1dGggaGVhZGVyIGluc3RlYWQgb2YgdGhlIGRlZmF1bHQgJ0F1dGhvcml6YXRpb24nXG4gICAgTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyLnNldEF1dGhIZWFkZXIoJ1gtQWNjZXNzLVRva2VuJyk7XG5cbiAgICAvLyBDaGFuZ2UgdGhlIFVSTCB3aGVyZSB0byBhY2Nlc3MgdGhlIExvb3BCYWNrIFJFU1QgQVBJIHNlcnZlclxuICAgIExvb3BCYWNrUmVzb3VyY2VQcm92aWRlci5zZXRVcmxCYXNlKGNvbmZpZ1NlcnZpY2UuZ2V0KCdhcGknKSk7XG4gIH0pXG4gIC5jb25maWcoZnVuY3Rpb24oJHN0YXRlUHJvdmlkZXIsICR1cmxSb3V0ZXJQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyXG4gICAgICAuc3RhdGUoJ2hvbWUnLCB7XG4gICAgICAgIHVybDogJy9ob21lJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvaG9tZS5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0hvbWVDdHJsJ1xuICAgICAgfSlcbiAgICAgIC5zdGF0ZSgnc2VhcmNoJywge1xuICAgICAgICB1cmw6ICcvc2VhcmNoLzpsYXQvOmxvbi86aW50ZXJlc3RzJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvc2VhcmNoLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnU2VhcmNoQ3RybCdcbiAgICAgIH0pO1xuXG4gICAgLy8gaWYgbm9uZSBvZiB0aGUgYWJvdmUgc3RhdGVzIGFyZSBtYXRjaGVkLCB1c2UgdGhpcyBhcyB0aGUgZmFsbGJhY2tcbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvaG9tZScpO1xuICB9KVxuICAuY29uZmlnKGZ1bmN0aW9uKCRtZFRoZW1pbmdQcm92aWRlciwgJG1kSWNvblByb3ZpZGVyKSB7XG4gICAgJG1kVGhlbWluZ1Byb3ZpZGVyLnRoZW1lKCdkZWZhdWx0Jyk7XG5cbiAgICAkbWRJY29uUHJvdmlkZXJcbiAgICAgIC5kZWZhdWx0SWNvblNldCgnL2Jvd2VyX2NvbXBvbmVudHMvYW5ndWxhci1tYXRlcmlhbC9kZW1vcy9pY29uL2RlbW9TdmdJY29uU2V0cy9hc3NldHMvY29yZS1pY29ucy5zdmcnLCAyNCk7XG5cbiAgfSlcblxuICAucnVuKGZ1bmN0aW9uKCkge1xuICAgIGFuZ3VsYXIuc3ByaW50ZiA9IGFuZ3VsYXIuc3ByaW50ZiB8fCB3aW5kb3cuc3ByaW50ZiB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfTtcbiAgfSk7XG4iLCJhcHAuY29udHJvbGxlcignRGlhbG9nQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgJG1kRGlhbG9nKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAkc2NvcGUuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgJG1kRGlhbG9nLmNhbmNlbCgpO1xuICB9O1xufSk7IiwiYXBwLmNvbnRyb2xsZXIoJ0hvbWVDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCB1aUdtYXBHb29nbGVNYXBBcGksICRpbmplY3Rvcil7XG4gIHZhciAkbWREaWFsb2cgPSAkaW5qZWN0b3IuZ2V0KCckbWREaWFsb2cnKSxcbiAgICBYb2xhU2VydmljZSA9ICRpbmplY3Rvci5nZXQoJ1hvbGFTZXJ2aWNlJyksXG4gICAgQWlycG9ydFNlcnZpY2UgPSAkaW5qZWN0b3IuZ2V0KCdBaXJwb3J0U2VydmljZScpLFxuICAgICR0aW1lb3V0ID0gJGluamVjdG9yLmdldCgnJHRpbWVvdXQnKSxcbiAgICAkbG9nID0gJGluamVjdG9yLmdldCgnJGxvZycpLFxuICAgICRzdGF0ZSA9ICRpbmplY3Rvci5nZXQoJyRzdGF0ZScpLFxuICAgICRyb290U2NvcGUgPSAkaW5qZWN0b3IuZ2V0KCckcm9vdFNjb3BlJyk7XG5cbiAgJHNjb3BlLm1hcCA9IHsgY2VudGVyOiB7IGxhdGl0dWRlOiA0NSwgbG9uZ2l0dWRlOiAtNzMgfSwgem9vbTogOCB9O1xuICAkc2NvcGUudHJpcCA9IHtcbiAgICBwcmljZTogMTAwXG4gIH07XG5cbiAgdWlHbWFwR29vZ2xlTWFwQXBpLnRoZW4oZnVuY3Rpb24obWFwcykge1xuICAgIC8vY29uc29sZS5pbmZvKG1hcHMpO1xuICB9KTtcblxuICAkcm9vdFNjb3BlLiRvbignU0VBUkNIX0NSSVRFUklBJywgZnVuY3Rpb24oZSwgc2VsZWN0ZWRDcml0ZXJpYSl7XG4gICAgJHJvb3RTY29wZS5zZWxlY3RlZENyaXRlcmlhID0gc2VsZWN0ZWRDcml0ZXJpYTtcbiAgICAkc3RhdGUuZ28oJ3NlYXJjaCcsIHtcbiAgICAgIGludGVyZXN0czogc2VsZWN0ZWRDcml0ZXJpYS5pbnRlcmVzdHMuam9pbignLCcpLFxuICAgICAgbGF0OiBzZWxlY3RlZENyaXRlcmlhLmFpcnBvcnQubGF0LFxuICAgICAgbG9uOiBzZWxlY3RlZENyaXRlcmlhLmFpcnBvcnQubG9uXG4gICAgfSk7XG4gIH0pO1xuXG4gICRzY29wZS5zdGFydCA9IGZ1bmN0aW9uKGV2KXtcbiAgICByZXR1cm4gJG1kRGlhbG9nLnNob3coe1xuICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkbWREaWFsb2csICRjb250cm9sbGVyKXtcbiAgICAgICAgJGNvbnRyb2xsZXIoJ0RpYWxvZ0NvbnRyb2xsZXInLCB7XG4gICAgICAgICAgJyRzY29wZSc6ICRzY29wZSxcbiAgICAgICAgICAnJG1kRGlhbG9nJzogJG1kRGlhbG9nXG4gICAgICAgIH0pO1xuICAgICAgICAkc2NvcGUuc2VsZWN0ZWRUYWIgPSAwO1xuICAgICAgICAkc2NvcGUub2ZmZXJzID0gW1xuICAgICAgICAgIHsgcHJpY2U6ICckMjUwJ30sXG4gICAgICAgICAgeyBwcmljZTogJyQzNTAnfSxcbiAgICAgICAgICB7IHByaWNlOiAnJDUwMCd9LFxuICAgICAgICAgIHsgcHJpY2U6ICckNzUwJ30sXG4gICAgICAgICAgeyBwcmljZTogJyQxMDAwJ30sXG4gICAgICAgICAgeyBwcmljZTogJz4gJDEwMDAnfVxuICAgICAgICBdO1xuXG4gICAgICAgIHZhciBzdGFydERhdGUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICB2YXIgZW5kRGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIGVuZERhdGUuc2V0RGF0ZShlbmREYXRlLmdldERhdGUoKSsyKTtcblxuICAgICAgICAkc2NvcGUuc2VsZWN0ZWQgPSB7XG4gICAgICAgICAgb2ZmZXI6IHtcbiAgICAgICAgICAgIGluZGV4OiBudWxsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBfaW50ZXJlc3RzOiB7fSxcbiAgICAgICAgICBkYXRlczoge1xuICAgICAgICAgICAgc3RhcnQ6IHN0YXJ0RGF0ZSxcbiAgICAgICAgICAgIGVuZDogZW5kRGF0ZVxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWlycG9ydDoge1xuICAgICAgICAgICAgXCJhaXJwb3J0X2NvZGVcIjogXCJTRk9cIixcbiAgICAgICAgICAgIFwibmFtZVwiOiBcIlNhbiBGcmFuY2lzY28gSW50ZXJuYXRpb25hbFwiLFxuICAgICAgICAgICAgXCJwbGFjZVwiOiBcIlNhbiBGcmFuY2lzY28sIENBXCIsXG4gICAgICAgICAgICBcImNvdW50cnlcIjogXCJVbml0ZWQgU3RhdGVzXCIsXG4gICAgICAgICAgICBcImNvdW50cnlfY29kZVwiOiBcIlVTXCIsXG4gICAgICAgICAgICBcImxhdFwiOiAzNy42MTg4ODksXG4gICAgICAgICAgICBcImxvbmdcIjogLTEyMi4zNzVcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgJHNjb3BlLnNlbGVjdE9mZmVyID0gZnVuY3Rpb24oaW5kZXgpe1xuICAgICAgICAgICRzY29wZS5zZWxlY3RlZC5vZmZlci5pbmRleCA9IGluZGV4O1xuICAgICAgICAgICRzY29wZS5zZWxlY3RlZFRhYiA9IDE7XG4gICAgICAgIH07XG5cbiAgICAgICAgJHNjb3BlLmludGVyZXN0cyA9IFhvbGFTZXJ2aWNlLmZldGNoKCk7XG5cbiAgICAgICAgJHNjb3BlLm5leHQgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICRzY29wZS5zZWxlY3RlZFRhYisrO1xuICAgICAgICB9O1xuXG4gICAgICAgICRzY29wZS5zaG93VG9vbGJhciA9IGZ1bmN0aW9uKG5hbWUpe1xuICAgICAgICAgIGlmKG5hbWUgPT09ICdkZWZhdWx0Jyl7XG4gICAgICAgICAgICByZXR1cm4gKCRzY29wZS5zZWxlY3RlZFRhYiAhPT0gMik7XG4gICAgICAgICAgfSBlbHNlIGlmKG5hbWUgPT09ICdmaW5hbCcpe1xuICAgICAgICAgICAgcmV0dXJuICgkc2NvcGUuc2VsZWN0ZWRUYWIgPT09IDIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAkc2NvcGUuc2VhcmNoID0gZnVuY3Rpb24oKXtcblxuICAgICAgICAgIHZhciBuZXdJbnRlcmVzZXRzID0gW11cbiAgICAgICAgICBfLmVhY2goJHNjb3BlLnNlbGVjdGVkLl9pbnRlcmVzdHMsIGZ1bmN0aW9uKGl0ZW0sIGluZGV4KXtcbiAgICAgICAgICAgIGlmKFN0cmluZyhpdGVtKS50b0xvd2VyQ2FzZSgpID09PSAndHJ1ZScpIHtcbiAgICAgICAgICAgICAgbmV3SW50ZXJlc2V0cy5wdXNoKCRzY29wZS5pbnRlcmVzdHNbaW5kZXhdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgICAgICAgICRzY29wZS5zZWxlY3RlZC5pbnRlcmVzdHMgPSBuZXdJbnRlcmVzZXRzO1xuICAgICAgICAgICRyb290U2NvcGUuJGVtaXQoJ1NFQVJDSF9DUklURVJJQScsICRzY29wZS5zZWxlY3RlZCk7XG4gICAgICAgICAgJHNjb3BlLmNhbmNlbCgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGxpc3Qgb2YgYHN0YXRlYCB2YWx1ZS9kaXNwbGF5IG9iamVjdHNcbiAgICAgICAgJHNjb3BlLnNpbXVsYXRlUXVlcnkgPSBmYWxzZTtcbiAgICAgICAgJHNjb3BlLmFpcnBvcnRzICAgICAgICA9IGxvYWRBbGwoKTtcbiAgICAgICAgJHNjb3BlLnF1ZXJ5U2VhcmNoICAgPSBxdWVyeVNlYXJjaDtcbiAgICAgICAgJHNjb3BlLnNlbGVjdGVkSXRlbUNoYW5nZSA9IHNlbGVjdGVkSXRlbUNoYW5nZTtcbiAgICAgICAgJHNjb3BlLnNlYXJjaFRleHRDaGFuZ2UgICA9IHNlYXJjaFRleHRDaGFuZ2U7XG4gICAgICAgICRzY29wZS5nZXRBaXJwb3J0TmFtZSA9IGdldEFpcnBvcnROYW1lO1xuXG4gICAgICAgIGZ1bmN0aW9uIHF1ZXJ5U2VhcmNoIChxdWVyeSkge1xuICAgICAgICAgIHZhciByZXN1bHRzID0gcXVlcnkgPyAkc2NvcGUuYWlycG9ydHMuZmlsdGVyKCBjcmVhdGVGaWx0ZXJGb3IocXVlcnkpICkgOiAkc2NvcGUuYWlycG9ydHMsXG4gICAgICAgICAgICBkZWZlcnJlZDtcbiAgICAgICAgICBpZiAoJHNjb3BlLnNpbXVsYXRlUXVlcnkpIHtcbiAgICAgICAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcbiAgICAgICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uICgpIHsgZGVmZXJyZWQucmVzb2x2ZSggcmVzdWx0cyApOyB9LCBNYXRoLnJhbmRvbSgpICogMTAwMCwgZmFsc2UpO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBzZWFyY2hUZXh0Q2hhbmdlKHRleHQpIHtcbiAgICAgICAgICAkbG9nLmluZm8oJ1RleHQgY2hhbmdlZCB0byAnICsgdGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gc2VsZWN0ZWRJdGVtQ2hhbmdlKGl0ZW0pIHtcbiAgICAgICAgICAkbG9nLmluZm8oJ0l0ZW0gY2hhbmdlZCB0byAnICsgSlNPTi5zdHJpbmdpZnkoaXRlbSkpO1xuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBCdWlsZCBgc3RhdGVzYCBsaXN0IG9mIGtleS92YWx1ZSBwYWlyc1xuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gbG9hZEFsbCgpIHtcbiAgICAgICAgICByZXR1cm4gQWlycG9ydFNlcnZpY2UuZmV0Y2goKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLyoqXG4gICAgICAgICAqIENyZWF0ZSBmaWx0ZXIgZnVuY3Rpb24gZm9yIGEgcXVlcnkgc3RyaW5nXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBjcmVhdGVGaWx0ZXJGb3IocXVlcnkpIHtcbiAgICAgICAgICB2YXIgbG93ZXJjYXNlUXVlcnkgPSBhbmd1bGFyLmxvd2VyY2FzZShxdWVyeSk7XG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGZpbHRlckZuKGFpcnBvcnQpIHtcbiAgICAgICAgICAgIHJldHVybiAoKGFpcnBvcnQuYWlycG9ydF9jb2RlLnRvTG93ZXJDYXNlKCkpLnNlYXJjaChsb3dlcmNhc2VRdWVyeSkgPiAtMSkgfHwgKChhaXJwb3J0Lm5hbWUudG9Mb3dlckNhc2UoKSkuc2VhcmNoKGxvd2VyY2FzZVF1ZXJ5KSA+IC0xKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gZ2V0QWlycG9ydE5hbWUoaXRlbSkge1xuICAgICAgICAgIHJldHVybiBpdGVtLmFpcnBvcnRfY29kZSsnIC8gJytpdGVtLm5hbWUrXCIsIFwiK2l0ZW0uY291bnRyeV9jb2RlO1xuICAgICAgICB9XG5cbiAgICAgIH0sXG4gICAgICBsb2NhbHM6IHsgcHJpY2U6ICRzY29wZS50cmlwLnByaWNlIH0sXG4gICAgICB0ZW1wbGF0ZVVybDogJ2pzL3RlbXBsYXRlcy9zdGFydC1tb2RhbC5odG1sJyxcbiAgICAgIHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuICAgICAgdGFyZ2V0RXZlbnQ6IGV2XG4gICAgfSk7XG4gIH1cblxufSk7IiwiYXBwLmNvbnRyb2xsZXIoJ1NlYXJjaEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRpbmplY3Rvcikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyICRzdGF0ZSA9ICRpbmplY3Rvci5nZXQoJyRzdGF0ZScpLFxuICAgICRodHRwID0gJGluamVjdG9yLmdldCgnJGh0dHAnKSxcbiAgICAkcm9vdFNjb3BlID0gJGluamVjdG9yLmdldCgnJHJvb3RTY29wZScpO1xuXG4gICRzY29wZS5haXJwb3J0cyA9IHt9O1xuICAkc2NvcGUuZGVmZXJyZWQ7XG4gICRzY29wZS5yZXN1bHRzID0gW107XG4gICRzY29wZS50b3RhbCA9IDA7XG4gICRzY29wZS5xdWVyeSA9ICcnO1xuICAkc2NvcGUuc2VhcmNoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGNyaXRlcmlhID0gYW5ndWxhci5jb3B5KCRyb290U2NvcGUuc2VsZWN0ZWRDcml0ZXJpYSB8fCB7XG4gICAgICAgIGludGVyZXN0czogW10sXG4gICAgICAgIGFpcnBvcnQ6IHtcbiAgICAgICAgICBsYXQ6ICcnLFxuICAgICAgICAgIGxvbjogJydcbiAgICAgICAgfVxuICAgICAgfSksXG4gICAgICBwYXJhbXMgPSBfLmRlZmF1bHRzKCgkc3RhdGUucGFyYW1zIHx8IHt9KSwge1xuICAgICAgICBpbnRlcmVzdHM6IGNyaXRlcmlhLmludGVyZXN0cy5qb2luKCcsJyksXG4gICAgICAgIGxhdDogY3JpdGVyaWEuYWlycG9ydC5sYXQsXG4gICAgICAgIGxvbjogY3JpdGVyaWEuYWlycG9ydC5sb24sXG4gICAgICAgIHJhZGl1czogNjAwMCxcbiAgICAgICAgbGltaXQ6IDIwMFxuICAgICAgfSksXG4gICAgICB1cmw7XG5cbiAgICBpZihwYXJhbXMpe1xuICAgICAgdXJsID0gYW5ndWxhci5zcHJpbnRmKFwiL2V2ZW50cz9pbnRlcmVzdHM9JShpbnRlcmVzdHMpcyZsYXQ9JShsYXQpcyZsb249JShsb24pcyZyYWQ9JShyYWRpdXMpcyZsaW1pdD0lKGxpbWl0KXNcIiwgcGFyYW1zKTtcbiAgICAgICRodHRwLmdldCh1cmwpXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKXtcblxuICAgICAgICAgIC8vIGZpbHRlciB0aGUgdGVzdCBkYXRhXG4gICAgICAgICAgcmVzcG9uc2UuZGF0YSA9IF8uZmlsdGVyKHJlc3BvbnNlLmRhdGEsIGZ1bmN0aW9uKGl0ZW0pe1xuICAgICAgICAgICAgdmFyIHRlc3QgPSBpdGVtLm5hbWUuc2VhcmNoKC90ZXN0fGFzZGZ8YWRqdXN0bWVudHxUaXRsZS9pKTtcbiAgICAgICAgICAgIHJldHVybiB0ZXN0ID09PSAtMVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gZ3JvdXAgYnkgYWlycG9ydFxuICAgICAgICAgIHJlc3BvbnNlLmRhdGEgPSBfLmdyb3VwQnkocmVzcG9uc2UuZGF0YSwgZnVuY3Rpb24oaXRlbSl7XG4gICAgICAgICAgICAkc2NvcGUuYWlycG9ydHNbaXRlbS5nZW8uYWlycG9ydC5jb2RlXSA9IGl0ZW0uZ2VvO1xuICAgICAgICAgICAgcmV0dXJuIGl0ZW0uZ2VvLmFpcnBvcnQuY29kZTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgICRzY29wZS5yZXN1bHRzID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgfVxuICB9O1xuXG4gICRzY29wZS5pbWFnZSA9IGZ1bmN0aW9uKHVybCl7XG4gICAgaWYodXJsICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gJy8vZGV2LnhvbGEuY29tJyArIHVybDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcvaW1nL2RlZmF1bHQuanBnJztcbiAgICB9XG4gIH07XG5cbiAgJHNjb3BlLmdldEFpcnBvcnREZXRhaWxzID0gZnVuY3Rpb24oYWlycG9ydF9jb2RlKXtcbiAgICB2YXIgYWlycG9ydCA9ICRzY29wZS5haXJwb3J0c1thaXJwb3J0X2NvZGVdLmFpcnBvcnQ7XG4gICAgcmV0dXJuIGFpcnBvcnQubmFtZSArIFwiIChcIithaXJwb3J0LmNvZGUgKyBcIilcIjtcbiAgfTtcblxuICAkc2NvcGUuZ2V0VmFsdWVJbk1pbGVzID0gZnVuY3Rpb24oa21zKXtcbiAgICByZXR1cm4gcGFyc2VJbnQoa21zKjAuNjIxMzcxMTkyKTtcbiAgfTtcblxuICAkc2NvcGUuc2VhcmNoKCk7XG59KTsiLCJhcHAuY29udHJvbGxlcignd29ya3NwYWNlQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAkc2NvcGUubWVudSA9IFtcbiAgICB7XG4gICAgICB0aXRsZTogJ0RpZ2VzdHMnLFxuICAgICAgaWNvbjogJ3ZpZXdfY2Fyb3VzZWwnLFxuICAgICAgc3RhdGU6ICdkaWdlc3RzJ1xuICAgIH0sXG4gICAge1xuICAgICAgdGl0bGU6ICdQb3N0cycsXG4gICAgICBpY29uOiAncGxheWxpc3RfYWRkZCcsXG4gICAgICBzdGF0ZTogJ3Bvc3RzJ1xuICAgIH1cbiAgXVxuXG4gICRzY29wZS5sZWZ0U2lkZW5hdk9wZW4gPSBmYWxzZTtcbiAgJHNjb3BlLnRvZ2dsZVNpZGVuYXYgPSBmdW5jdGlvbigpe1xuICAgICRzY29wZS5sZWZ0U2lkZW5hdk9wZW4gPSAhJHNjb3BlLmxlZnRTaWRlbmF2T3BlbjtcbiAgfVxuXG4gICRzY29wZS5jaGFuZ2VTdGF0ZSA9IGZ1bmN0aW9uKHN0YXRlKXtcbiAgICAkc3RhdGUuZ28oc3RhdGUpO1xuICAgICRzY29wZS50b2dnbGVTaWRlbmF2KCk7XG4gIH1cblxufSk7IiwiYXBwLmRpcmVjdGl2ZShcInByaWNlU2VsZWN0b3JcIiwgZnVuY3Rpb24oKSB7XG4gIHJldHVybiB7XG4gICAgcmVxdWlyZTogXCJuZ01vZGVsXCIsXG4gICAgc2NvcGU6IHtcbiAgICAgIHByaWNlOiAnPW5nTW9kZWwnXG4gICAgfSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3RlbXBsYXRlcy9wcmljZS1zZWxlY3Rvci5odG1sJyxcbiAgICBsaW5rOiBmdW5jdGlvbigkc2NvcGUpIHtcblxuICAgIH1cbiAgfTtcbn0pOyIsIi8qKlxuICogQ3JlYXRlZCBieSByYWdoYXZhY2hpbm5hcHBhIG9uIDExLzgvMTUuXG4gKi9cbmFwcC5maWx0ZXIoJ21pbGVGaWx0ZXInLCBmdW5jdGlvbigpe1xuICByZXR1cm4gZnVuY3Rpb24oa21zKXtcbiAgICByZXR1cm4gcGFyc2VJbnQoa21zKjAuMDAwNjIxMzcxMTkyKTtcbiAgfTtcbn0pOyIsImFwcC5zZXJ2aWNlKCdBaXJwb3J0U2VydmljZScsIGZ1bmN0aW9uKCRpbmplY3Rvcikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyIGFpcnBvcnRzID0gW3tcbiAgICBcImFpcnBvcnRfY29kZVwiOiBcIlNBVFwiLFxuICAgIFwibmFtZVwiOiBcIlNhbiBBbnRvbmlvIEludGVybmF0aW9uYWxcIixcbiAgICBcInBsYWNlXCI6IFwiU2FuIEFudG9uaW9cIixcbiAgICBcImNvdW50cnlcIjogXCJVbml0ZWQgU3RhdGVzXCIsXG4gICAgXCJjb3VudHJ5X2NvZGVcIjogXCJVU1wiLFxuICAgIFwibGF0XCI6IDI5LjUzMzMzMyxcbiAgICBcImxvblwiOiAtOTguNDY2NjY3XG4gIH0sXG4gICAge1xuICAgICAgXCJhaXJwb3J0X2NvZGVcIjogXCJTUUxcIixcbiAgICAgIFwibmFtZVwiOiBcIlNhbiBDYXJsb3NcIixcbiAgICAgIFwicGxhY2VcIjogXCJTYW4gQ2FybG9zXCIsXG4gICAgICBcImNvdW50cnlcIjogXCJVbml0ZWQgU3RhdGVzXCIsXG4gICAgICBcImNvdW50cnlfY29kZVwiOiBcIlVTXCIsXG4gICAgICBcImxhdFwiOiAzNy40ODMzMzMsXG4gICAgICBcImxvblwiOiAtMTIyLjI1XG4gICAgfSxcbiAgICB7XG4gICAgICBcImFpcnBvcnRfY29kZVwiOiBcIlNBTlwiLFxuICAgICAgXCJuYW1lXCI6IFwiU2FuIERpZWdvIEludGVybmF0aW9uYWwgQWlycG9ydFwiLFxuICAgICAgXCJwbGFjZVwiOiBcIlNhbiBEaWVnb1wiLFxuICAgICAgXCJjb3VudHJ5XCI6IFwiVW5pdGVkIFN0YXRlc1wiLFxuICAgICAgXCJjb3VudHJ5X2NvZGVcIjogXCJVU1wiLFxuICAgICAgXCJsYXRcIjogMzIuNzMzMzMzLFxuICAgICAgXCJsb25cIjogLTExNy4xODMzMzNcbiAgICB9LFxuICAgIHtcbiAgICAgIFwiYWlycG9ydF9jb2RlXCI6IFwiU0ZPXCIsXG4gICAgICBcIm5hbWVcIjogXCJTYW4gRnJhbmNpc2NvIEludGVybmF0aW9uYWxcIixcbiAgICAgIFwicGxhY2VcIjogXCJTYW4gRnJhbmNpc2NvLCBDQVwiLFxuICAgICAgXCJjb3VudHJ5XCI6IFwiVW5pdGVkIFN0YXRlc1wiLFxuICAgICAgXCJjb3VudHJ5X2NvZGVcIjogXCJVU1wiLFxuICAgICAgXCJsYXRcIjogMzcuNjE4ODg5LFxuICAgICAgXCJsb25cIjogLTEyMi4zNzVcbiAgICB9XTtcblxuICB2YXIgZXhwb3J0cyA9IHt9O1xuICBleHBvcnRzLmZldGNoID0gZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gYWlycG9ydHM7XG4gIH07XG5cbiAgcmV0dXJuIGV4cG9ydHM7XG59KTtcbiIsImFwcC5zZXJ2aWNlKCdoZWxwZXInLCBmdW5jdGlvbiAoJGZpbHRlcikge1xuICAndXNlIHN0cmljdCc7XG4gIHZhciBleHBvcnRzID0ge307XG5cbiAgZXhwb3J0cy5pc0Rpc3BsYXkgPSBmdW5jdGlvbih0eXBlKXtcbiAgICByZXR1cm4gKHR5cGUgPT09ICdkaXNwbGF5Jyk7XG4gIH07XG5cbiAgZXhwb3J0cy5yZW5kZXJEYXRlQ29sdW1uID0gZnVuY3Rpb24gKGRhdGEsIHR5cGUpIHtcbiAgICByZXR1cm4gZXhwb3J0cy5pc0Rpc3BsYXkodHlwZSk/ICRmaWx0ZXIoJ2RhdGUnLCAnc2hvcnQnKShkYXRhKSA6ICcnO1xuICB9O1xuXG4gIGV4cG9ydHMucmVuZGVyTGlua0NvbHVtbiA9IGZ1bmN0aW9uIChkYXRhLCB0eXBlLCBmdWxsKSB7XG4gICAgaWYoZXhwb3J0cy5pc0Rpc3BsYXkodHlwZSkpe1xuICAgICAgcmV0dXJuIGFuZ3VsYXIuc3ByaW50ZignPGEgaHJlZj1cIiMvcG9zdHMvJShpZClzXCIgZGF0YS1pZD1cIiUoaWQpc1wiPiUodGl0bGUpczwvYT4nLCB7XG4gICAgICAgIGlkOiBmdWxsLmlkLFxuICAgICAgICB0aXRsZTogZnVsbC50aXRsZVxuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiAnJztcbiAgfTtcblxuICBleHBvcnRzLmlzQXJyYXlFcXVhbCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gXy5hbGwoXy56aXAoYSwgYiksIGZ1bmN0aW9uKHgpIHtcbiAgICAgIHJldHVybiB4WzBdID09PSB4WzFdO1xuICAgIH0pO1xuICB9O1xuXG4gIHJldHVybiBleHBvcnRzO1xufSk7XG4iLCIoZnVuY3Rpb24od2luZG93LCBhbmd1bGFyLCB1bmRlZmluZWQpIHsndXNlIHN0cmljdCc7XG5cbnZhciB1cmxCYXNlID0gXCIvYXBpXCI7XG52YXIgYXV0aEhlYWRlciA9ICdhdXRob3JpemF0aW9uJztcblxuLyoqXG4gKiBAbmdkb2Mgb3ZlcnZpZXdcbiAqIEBuYW1lIGxiU2VydmljZXNcbiAqIEBtb2R1bGVcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIFRoZSBgbGJTZXJ2aWNlc2AgbW9kdWxlIHByb3ZpZGVzIHNlcnZpY2VzIGZvciBpbnRlcmFjdGluZyB3aXRoXG4gKiB0aGUgbW9kZWxzIGV4cG9zZWQgYnkgdGhlIExvb3BCYWNrIHNlcnZlciB2aWEgdGhlIFJFU1QgQVBJLlxuICpcbiAqL1xudmFyIG1vZHVsZSA9IGFuZ3VsYXIubW9kdWxlKFwibGJTZXJ2aWNlc1wiLCBbJ25nUmVzb3VyY2UnXSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyXG4gKiBAaGVhZGVyIGxiU2VydmljZXMuVXNlclxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYFVzZXJgIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiVXNlclwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvdXNlcnMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5maW5kQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZmluZEJ5SWRfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmRlc3Ryb3lCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19kZXN0cm95QnlJZF9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMudXBkYXRlQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fdXBkYXRlQnlJZF9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5maW5kQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZmluZEJ5SWRfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmRlc3Ryb3lCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19kZXN0cm95QnlJZF9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMudXBkYXRlQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fdXBkYXRlQnlJZF9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5maW5kQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZmluZEJ5SWRfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmRlc3Ryb3lCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19kZXN0cm95QnlJZF9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMudXBkYXRlQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fdXBkYXRlQnlJZF9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2VucygpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZ2V0X19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuY3JlYXRlKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19jcmVhdGVfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmRlc3Ryb3lBbGwoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2RlbGV0ZV9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5jb3VudCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fY291bnRfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscygpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZ2V0X19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuY3JlYXRlKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19jcmVhdGVfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmRlc3Ryb3lBbGwoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2RlbGV0ZV9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5jb3VudCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fY291bnRfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcygpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZ2V0X19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuY3JlYXRlKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19jcmVhdGVfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmRlc3Ryb3lBbGwoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2RlbGV0ZV9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5jb3VudCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fY291bnRfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vyc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2xvZ2luXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIExvZ2luIGEgdXNlciB3aXRoIHVzZXJuYW1lL2VtYWlsIGFuZCBwYXNzd29yZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGluY2x1ZGVgIOKAkyBge3N0cmluZz19YCAtIFJlbGF0ZWQgb2JqZWN0cyB0byBpbmNsdWRlIGluIHRoZSByZXNwb25zZS4gU2VlIHRoZSBkZXNjcmlwdGlvbiBvZiByZXR1cm4gdmFsdWUgZm9yIG1vcmUgZGV0YWlscy5cbiAgICAgICAgICogICBEZWZhdWx0IHZhbHVlOiBgdXNlcmAuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGByZW1lbWJlck1lYCAtIGBib29sZWFuYCAtIFdoZXRoZXIgdGhlIGF1dGhlbnRpY2F0aW9uIGNyZWRlbnRpYWxzXG4gICAgICAgICAqICAgICBzaG91bGQgYmUgcmVtZW1iZXJlZCBpbiBsb2NhbFN0b3JhZ2UgYWNyb3NzIGFwcC9icm93c2VyIHJlc3RhcnRzLlxuICAgICAgICAgKiAgICAgRGVmYXVsdDogYHRydWVgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGUgcmVzcG9uc2UgYm9keSBjb250YWlucyBwcm9wZXJ0aWVzIG9mIHRoZSBBY2Nlc3NUb2tlbiBjcmVhdGVkIG9uIGxvZ2luLlxuICAgICAgICAgKiBEZXBlbmRpbmcgb24gdGhlIHZhbHVlIG9mIGBpbmNsdWRlYCBwYXJhbWV0ZXIsIHRoZSBib2R5IG1heSBjb250YWluIGFkZGl0aW9uYWwgcHJvcGVydGllczpcbiAgICAgICAgICogXG4gICAgICAgICAqICAgLSBgdXNlcmAgLSBge1VzZXJ9YCAtIERhdGEgb2YgdGhlIGN1cnJlbnRseSBsb2dnZWQgaW4gdXNlci4gKGBpbmNsdWRlPXVzZXJgKVxuICAgICAgICAgKiBcbiAgICAgICAgICpcbiAgICAgICAgICovXG4gICAgICAgIFwibG9naW5cIjoge1xuICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgaW5jbHVkZTogXCJ1c2VyXCJcbiAgICAgICAgICB9LFxuICAgICAgICAgIGludGVyY2VwdG9yOiB7XG4gICAgICAgICAgICByZXNwb25zZTogZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgdmFyIGFjY2Vzc1Rva2VuID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgICAgTG9vcEJhY2tBdXRoLnNldFVzZXIoYWNjZXNzVG9rZW4uaWQsIGFjY2Vzc1Rva2VuLnVzZXJJZCwgYWNjZXNzVG9rZW4udXNlcik7XG4gICAgICAgICAgICAgIExvb3BCYWNrQXV0aC5yZW1lbWJlck1lID0gcmVzcG9uc2UuY29uZmlnLnBhcmFtcy5yZW1lbWJlck1lICE9PSBmYWxzZTtcbiAgICAgICAgICAgICAgTG9vcEJhY2tBdXRoLnNhdmUoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvbG9naW5cIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2xvZ291dFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBMb2dvdXQgYSB1c2VyIHdpdGggYWNjZXNzIHRva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBhY2Nlc3NfdG9rZW5gIOKAkyBge3N0cmluZ31gIC0gRG8gbm90IHN1cHBseSB0aGlzIGFyZ3VtZW50LCBpdCBpcyBhdXRvbWF0aWNhbGx5IGV4dHJhY3RlZCBmcm9tIHJlcXVlc3QgaGVhZGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJsb2dvdXRcIjoge1xuICAgICAgICAgIGludGVyY2VwdG9yOiB7XG4gICAgICAgICAgICByZXNwb25zZTogZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgTG9vcEJhY2tBdXRoLmNsZWFyVXNlcigpO1xuICAgICAgICAgICAgICBMb29wQmFja0F1dGguY2xlYXJTdG9yYWdlKCk7XG4gICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL2xvZ291dFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjY29uZmlybVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb25maXJtIGEgdXNlciByZWdpc3RyYXRpb24gd2l0aCBlbWFpbCB2ZXJpZmljYXRpb24gdG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHVpZGAg4oCTIGB7c3RyaW5nfWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHRva2VuYCDigJMgYHtzdHJpbmd9YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgcmVkaXJlY3RgIOKAkyBge3N0cmluZz19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImNvbmZpcm1cIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL2NvbmZpcm1cIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjcmVzZXRQYXNzd29yZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBSZXNldCBwYXNzd29yZCBmb3IgYSB1c2VyIHdpdGggZW1haWxcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJyZXNldFBhc3N3b3JkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy9yZXNldFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIEFjY2Vzc1Rva2VuLnVzZXIoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Z2V0OjphY2Nlc3NUb2tlbjo6dXNlclwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZC91c2VyXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyQ3JlZGVudGlhbC51c2VyKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmdldDo6dXNlckNyZWRlbnRpYWw6OnVzZXJcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWQvdXNlclwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlcklkZW50aXR5LnVzZXIoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Z2V0Ojp1c2VySWRlbnRpdHk6OnVzZXJcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZC91c2VyXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2dldEN1cnJlbnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogR2V0IGRhdGEgb2YgdGhlIGN1cnJlbnRseSBsb2dnZWQgdXNlci4gRmFpbCB3aXRoIEhUVFAgcmVzdWx0IDQwMVxuICAgICAgICAgKiB3aGVuIHRoZXJlIGlzIG5vIHVzZXIgbG9nZ2VkIGluLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqL1xuICAgICAgICBcImdldEN1cnJlbnRcIjoge1xuICAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vyc1wiICsgXCIvOmlkXCIsXG4gICAgICAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgaWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB2YXIgaWQgPSBMb29wQmFja0F1dGguY3VycmVudFVzZXJJZDtcbiAgICAgICAgICAgICAgaWYgKGlkID09IG51bGwpIGlkID0gJ19fYW5vbnltb3VzX18nO1xuICAgICAgICAgICAgICByZXR1cm4gaWQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW50ZXJjZXB0b3I6IHtcbiAgICAgICAgICAgIHJlc3BvbnNlOiBmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICBMb29wQmFja0F1dGguY3VycmVudFVzZXJEYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgX19pc0dldEN1cnJlbnRVc2VyX18gOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZ2V0Q2FjaGVkQ3VycmVudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBHZXQgZGF0YSBvZiB0aGUgY3VycmVudGx5IGxvZ2dlZCB1c2VyIHRoYXQgd2FzIHJldHVybmVkIGJ5IHRoZSBsYXN0XG4gICAgICAgICAqIGNhbGwgdG8ge0BsaW5rIGxiU2VydmljZXMuVXNlciNsb2dpbn0gb3JcbiAgICAgICAgICoge0BsaW5rIGxiU2VydmljZXMuVXNlciNnZXRDdXJyZW50fS4gUmV0dXJuIG51bGwgd2hlbiB0aGVyZVxuICAgICAgICAgKiBpcyBubyB1c2VyIGxvZ2dlZCBpbiBvciB0aGUgZGF0YSBvZiB0aGUgY3VycmVudCB1c2VyIHdlcmUgbm90IGZldGNoZWRcbiAgICAgICAgICogeWV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBIFVzZXIgaW5zdGFuY2UuXG4gICAgICAgICAqL1xuICAgICAgICBSLmdldENhY2hlZEN1cnJlbnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgZGF0YSA9IExvb3BCYWNrQXV0aC5jdXJyZW50VXNlckRhdGE7XG4gICAgICAgICAgcmV0dXJuIGRhdGEgPyBuZXcgUihkYXRhKSA6IG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2lzQXV0aGVudGljYXRlZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjdXJyZW50IHVzZXIgaXMgYXV0aGVudGljYXRlZCAobG9nZ2VkIGluKS5cbiAgICAgICAgICovXG4gICAgICAgIFIuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0Q3VycmVudElkKCkgIT0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZ2V0Q3VycmVudElkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gSWQgb2YgdGhlIGN1cnJlbnRseSBsb2dnZWQtaW4gdXNlciBvciBudWxsLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5nZXRDdXJyZW50SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gTG9vcEJhY2tBdXRoLmN1cnJlbnRVc2VySWQ7XG4gICAgICAgIH07XG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYFVzZXJgLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIlVzZXJcIjtcblxuICAgIC8qKlxuICAgICAqIEBuZ2RvYyBvYmplY3RcbiAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICogQGhlYWRlciBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICogQG9iamVjdFxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqXG4gICAgICogVGhlIG9iamVjdCBgVXNlci5hY2Nlc3NUb2tlbnNgIGdyb3VwcyBtZXRob2RzXG4gICAgICogbWFuaXB1bGF0aW5nIGBBY2Nlc3NUb2tlbmAgaW5zdGFuY2VzIHJlbGF0ZWQgdG8gYFVzZXJgLlxuICAgICAqXG4gICAgICogQ2FsbCB7QGxpbmsgbGJTZXJ2aWNlcy5Vc2VyI2FjY2Vzc1Rva2VucyBVc2VyLmFjY2Vzc1Rva2VucygpfVxuICAgICAqIHRvIHF1ZXJ5IGFsbCByZWxhdGVkIGluc3RhbmNlcy5cbiAgICAgKi9cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNhY2Nlc3NUb2tlbnNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogUXVlcmllcyBhY2Nlc3NUb2tlbnMgb2YgdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Z2V0Ojp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnMjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50cyBhY2Nlc3NUb2tlbnMgb2YgdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zLmNvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Y291bnQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2VucyNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2UgaW4gYWNjZXNzVG9rZW5zIG9mIHRoaXMgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMuY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Y3JlYXRlOjp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnMjZGVzdHJveUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlcyBhbGwgYWNjZXNzVG9rZW5zIG9mIHRoaXMgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2Vucy5kZXN0cm95QWxsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZGVsZXRlOjp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnMjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgYWNjZXNzVG9rZW5zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zLmRlc3Ryb3lCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZGVzdHJveUJ5SWQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2VucyNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgYWNjZXNzVG9rZW5zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2Vucy5maW5kQnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmZpbmRCeUlkOjp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnMjdXBkYXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBhY2Nlc3NUb2tlbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBhY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zLnVwZGF0ZUJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjp1cGRhdGVCeUlkOjp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIC8qKlxuICAgICAqIEBuZ2RvYyBvYmplY3RcbiAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgKiBAaGVhZGVyIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAqIEBvYmplY3RcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKlxuICAgICAqIFRoZSBvYmplY3QgYFVzZXIuY3JlZGVudGlhbHNgIGdyb3VwcyBtZXRob2RzXG4gICAgICogbWFuaXB1bGF0aW5nIGBVc2VyQ3JlZGVudGlhbGAgaW5zdGFuY2VzIHJlbGF0ZWQgdG8gYFVzZXJgLlxuICAgICAqXG4gICAgICogQ2FsbCB7QGxpbmsgbGJTZXJ2aWNlcy5Vc2VyI2NyZWRlbnRpYWxzIFVzZXIuY3JlZGVudGlhbHMoKX1cbiAgICAgKiB0byBxdWVyeSBhbGwgcmVsYXRlZCBpbnN0YW5jZXMuXG4gICAgICovXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjY3JlZGVudGlhbHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogUXVlcmllcyBjcmVkZW50aWFscyBvZiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmdldDo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFscyNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudHMgY3JlZGVudGlhbHMgb2YgdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMuY291bnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpjb3VudDo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFscyNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBpbiBjcmVkZW50aWFscyBvZiB0aGlzIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMuY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Y3JlYXRlOjp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzI2Rlc3Ryb3lBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlcyBhbGwgY3JlZGVudGlhbHMgb2YgdGhpcyBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMuZGVzdHJveUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmRlbGV0ZTo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFscyNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGNyZWRlbnRpYWxzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscy5kZXN0cm95QnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmRlc3Ryb3lCeUlkOjp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGNyZWRlbnRpYWxzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMuZmluZEJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpmaW5kQnlJZDo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFscyN1cGRhdGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgY3JlZGVudGlhbHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBjcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscy51cGRhdGVCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6dXBkYXRlQnlJZDo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIC8qKlxuICAgICAqIEBuZ2RvYyBvYmplY3RcbiAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgKiBAb2JqZWN0XG4gICAgICogQGRlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBUaGUgb2JqZWN0IGBVc2VyLmlkZW50aXRpZXNgIGdyb3VwcyBtZXRob2RzXG4gICAgICogbWFuaXB1bGF0aW5nIGBVc2VySWRlbnRpdHlgIGluc3RhbmNlcyByZWxhdGVkIHRvIGBVc2VyYC5cbiAgICAgKlxuICAgICAqIENhbGwge0BsaW5rIGxiU2VydmljZXMuVXNlciNpZGVudGl0aWVzIFVzZXIuaWRlbnRpdGllcygpfVxuICAgICAqIHRvIHF1ZXJ5IGFsbCByZWxhdGVkIGluc3RhbmNlcy5cbiAgICAgKi9cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNpZGVudGl0aWVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFF1ZXJpZXMgaWRlbnRpdGllcyBvZiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpnZXQ6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnRzIGlkZW50aXRpZXMgb2YgdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcy5jb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpjb3VudDo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXMjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBpbiBpZGVudGl0aWVzIG9mIHRoaXMgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcy5jcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Y3JlYXRlOjp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllcyNkZXN0cm95QWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlcyBhbGwgaWRlbnRpdGllcyBvZiB0aGlzIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzLmRlc3Ryb3lBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZGVsZXRlOjp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllcyNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgaWRlbnRpdGllcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzLmRlc3Ryb3lCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmRlc3Ryb3lCeUlkOjp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllcyNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGlkZW50aXRpZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBpZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzLmZpbmRCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmZpbmRCeUlkOjp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllcyN1cGRhdGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBpZGVudGl0aWVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcy51cGRhdGVCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OnVwZGF0ZUJ5SWQ6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gKiBAaGVhZGVyIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBBY2Nlc3NUb2tlbmAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJBY2Nlc3NUb2tlblwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgQWNjZXNzVG9rZW4udXNlcigpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZ2V0X191c2VyXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkL3VzZXJcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIEFjY2Vzc1Rva2VuIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5maW5kQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpmaW5kQnlJZDo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuZGVzdHJveUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZGVzdHJveUJ5SWQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLnVwZGF0ZUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6dXBkYXRlQnlJZDo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Z2V0Ojp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuY3JlYXRlKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmNyZWF0ZTo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuZGVzdHJveUFsbCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpkZWxldGU6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuY291bnQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Y291bnQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgQWNjZXNzVG9rZW5gLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIkFjY2Vzc1Rva2VuXCI7XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3VzZXJcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZldGNoZXMgYmVsb25nc1RvIHJlbGF0aW9uIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gQWNjZXNzVG9rZW4gaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHJlZnJlc2hgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi51c2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpnZXQ6OmFjY2Vzc1Rva2VuOjp1c2VyXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICogQGhlYWRlciBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgVXNlckNyZWRlbnRpYWxgIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiVXNlckNyZWRlbnRpYWxcIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXJDcmVkZW50aWFsLnVzZXIoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2dldF9fdXNlclwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZC91c2VyXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyQ3JlZGVudGlhbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5maW5kQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpmaW5kQnlJZDo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuZGVzdHJveUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZGVzdHJveUJ5SWQ6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLnVwZGF0ZUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6dXBkYXRlQnlJZDo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Z2V0Ojp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuY3JlYXRlKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmNyZWF0ZTo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuZGVzdHJveUFsbCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpkZWxldGU6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuY291bnQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Y291bnQ6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYFVzZXJDcmVkZW50aWFsYC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJVc2VyQ3JlZGVudGlhbFwiO1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCN1c2VyXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGZXRjaGVzIGJlbG9uZ3NUbyByZWxhdGlvbiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXJDcmVkZW50aWFsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGByZWZyZXNoYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIudXNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Z2V0Ojp1c2VyQ3JlZGVudGlhbDo6dXNlclwiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gKiBAaGVhZGVyIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgVXNlcklkZW50aXR5YCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIlVzZXJJZGVudGl0eVwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VySWRlbnRpdHkudXNlcigpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZ2V0X191c2VyXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWQvdXNlclwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXJJZGVudGl0eSBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmZpbmRCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmZpbmRCeUlkOjp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5kZXN0cm95QnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpkZXN0cm95QnlJZDo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMudXBkYXRlQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjp1cGRhdGVCeUlkOjp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcygpIGluc3RlYWQuXG4gICAgICAgIFwiOjpnZXQ6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5jcmVhdGUoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Y3JlYXRlOjp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5kZXN0cm95QWxsKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmRlbGV0ZTo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5jb3VudCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpjb3VudDo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgVXNlcklkZW50aXR5YC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJVc2VySWRlbnRpdHlcIjtcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3VzZXJcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGZXRjaGVzIGJlbG9uZ3NUbyByZWxhdGlvbiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXJJZGVudGl0eSBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgcmVmcmVzaGAg4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLnVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlclwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmdldDo6dXNlcklkZW50aXR5Ojp1c2VyXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0XG4gKiBAaGVhZGVyIGxiU2VydmljZXMuUG9zdFxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYFBvc3RgIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiUG9zdFwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvcG9zdHMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFBlcnNpc3RlZE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYFBvc3RgLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIlBvc3RcIjtcblxuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlXG4gKiBAaGVhZGVyIGxiU2VydmljZXMuSW1hZ2VcbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBJbWFnZWAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJJbWFnZVwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvaW1hZ2VzLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gUGVyc2lzdGVkTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYEltYWdlYC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJJbWFnZVwiO1xuXG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0XG4gKiBAaGVhZGVyIGxiU2VydmljZXMuRGlnZXN0XG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgRGlnZXN0YCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIkRpZ2VzdFwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvZGlnZXN0cy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBQZXJzaXN0ZWRNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYERpZ2VzdGAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiRGlnZXN0XCI7XG5cblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cblxubW9kdWxlXG4gIC5mYWN0b3J5KCdMb29wQmFja0F1dGgnLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvcHMgPSBbJ2FjY2Vzc1Rva2VuSWQnLCAnY3VycmVudFVzZXJJZCddO1xuICAgIHZhciBwcm9wc1ByZWZpeCA9ICckTG9vcEJhY2skJztcblxuICAgIGZ1bmN0aW9uIExvb3BCYWNrQXV0aCgpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHByb3BzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBzZWxmW25hbWVdID0gbG9hZChuYW1lKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5yZW1lbWJlck1lID0gdW5kZWZpbmVkO1xuICAgICAgdGhpcy5jdXJyZW50VXNlckRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIExvb3BCYWNrQXV0aC5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHN0b3JhZ2UgPSB0aGlzLnJlbWVtYmVyTWUgPyBsb2NhbFN0b3JhZ2UgOiBzZXNzaW9uU3RvcmFnZTtcbiAgICAgIHByb3BzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBzYXZlKHN0b3JhZ2UsIG5hbWUsIHNlbGZbbmFtZV0pO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIExvb3BCYWNrQXV0aC5wcm90b3R5cGUuc2V0VXNlciA9IGZ1bmN0aW9uKGFjY2Vzc1Rva2VuSWQsIHVzZXJJZCwgdXNlckRhdGEpIHtcbiAgICAgIHRoaXMuYWNjZXNzVG9rZW5JZCA9IGFjY2Vzc1Rva2VuSWQ7XG4gICAgICB0aGlzLmN1cnJlbnRVc2VySWQgPSB1c2VySWQ7XG4gICAgICB0aGlzLmN1cnJlbnRVc2VyRGF0YSA9IHVzZXJEYXRhO1xuICAgIH1cblxuICAgIExvb3BCYWNrQXV0aC5wcm90b3R5cGUuY2xlYXJVc2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmFjY2Vzc1Rva2VuSWQgPSBudWxsO1xuICAgICAgdGhpcy5jdXJyZW50VXNlcklkID0gbnVsbDtcbiAgICAgIHRoaXMuY3VycmVudFVzZXJEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBMb29wQmFja0F1dGgucHJvdG90eXBlLmNsZWFyU3RvcmFnZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcHJvcHMuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHNhdmUoc2Vzc2lvblN0b3JhZ2UsIG5hbWUsIG51bGwpO1xuICAgICAgICBzYXZlKGxvY2FsU3RvcmFnZSwgbmFtZSwgbnVsbCk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBMb29wQmFja0F1dGgoKTtcblxuICAgIC8vIE5vdGU6IExvY2FsU3RvcmFnZSBjb252ZXJ0cyB0aGUgdmFsdWUgdG8gc3RyaW5nXG4gICAgLy8gV2UgYXJlIHVzaW5nIGVtcHR5IHN0cmluZyBhcyBhIG1hcmtlciBmb3IgbnVsbC91bmRlZmluZWQgdmFsdWVzLlxuICAgIGZ1bmN0aW9uIHNhdmUoc3RvcmFnZSwgbmFtZSwgdmFsdWUpIHtcbiAgICAgIHZhciBrZXkgPSBwcm9wc1ByZWZpeCArIG5hbWU7XG4gICAgICBpZiAodmFsdWUgPT0gbnVsbCkgdmFsdWUgPSAnJztcbiAgICAgIHN0b3JhZ2Vba2V5XSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWQobmFtZSkge1xuICAgICAgdmFyIGtleSA9IHByb3BzUHJlZml4ICsgbmFtZTtcbiAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2Vba2V5XSB8fCBzZXNzaW9uU3RvcmFnZVtrZXldIHx8IG51bGw7XG4gICAgfVxuICB9KVxuICAuY29uZmlnKFsnJGh0dHBQcm92aWRlcicsIGZ1bmN0aW9uKCRodHRwUHJvdmlkZXIpIHtcbiAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKCdMb29wQmFja0F1dGhSZXF1ZXN0SW50ZXJjZXB0b3InKTtcbiAgfV0pXG4gIC5mYWN0b3J5KCdMb29wQmFja0F1dGhSZXF1ZXN0SW50ZXJjZXB0b3InLCBbICckcScsICdMb29wQmFja0F1dGgnLFxuICAgIGZ1bmN0aW9uKCRxLCBMb29wQmFja0F1dGgpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgICdyZXF1ZXN0JzogZnVuY3Rpb24oY29uZmlnKSB7XG5cbiAgICAgICAgICAvLyBmaWx0ZXIgb3V0IG5vbiB1cmxCYXNlIHJlcXVlc3RzXG4gICAgICAgICAgaWYgKGNvbmZpZy51cmwuc3Vic3RyKDAsIHVybEJhc2UubGVuZ3RoKSAhPT0gdXJsQmFzZSkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbmZpZztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoTG9vcEJhY2tBdXRoLmFjY2Vzc1Rva2VuSWQpIHtcbiAgICAgICAgICAgIGNvbmZpZy5oZWFkZXJzW2F1dGhIZWFkZXJdID0gTG9vcEJhY2tBdXRoLmFjY2Vzc1Rva2VuSWQ7XG4gICAgICAgICAgfSBlbHNlIGlmIChjb25maWcuX19pc0dldEN1cnJlbnRVc2VyX18pIHtcbiAgICAgICAgICAgIC8vIFJldHVybiBhIHN0dWIgNDAxIGVycm9yIGZvciBVc2VyLmdldEN1cnJlbnQoKSB3aGVuXG4gICAgICAgICAgICAvLyB0aGVyZSBpcyBubyB1c2VyIGxvZ2dlZCBpblxuICAgICAgICAgICAgdmFyIHJlcyA9IHtcbiAgICAgICAgICAgICAgYm9keTogeyBlcnJvcjogeyBzdGF0dXM6IDQwMSB9IH0sXG4gICAgICAgICAgICAgIHN0YXR1czogNDAxLFxuICAgICAgICAgICAgICBjb25maWc6IGNvbmZpZyxcbiAgICAgICAgICAgICAgaGVhZGVyczogZnVuY3Rpb24oKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBjb25maWcgfHwgJHEud2hlbihjb25maWcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfV0pXG5cbiAgLyoqXG4gICAqIEBuZ2RvYyBvYmplY3RcbiAgICogQG5hbWUgbGJTZXJ2aWNlcy5Mb29wQmFja1Jlc291cmNlUHJvdmlkZXJcbiAgICogQGhlYWRlciBsYlNlcnZpY2VzLkxvb3BCYWNrUmVzb3VyY2VQcm92aWRlclxuICAgKiBAZGVzY3JpcHRpb25cbiAgICogVXNlIGBMb29wQmFja1Jlc291cmNlUHJvdmlkZXJgIHRvIGNoYW5nZSB0aGUgZ2xvYmFsIGNvbmZpZ3VyYXRpb25cbiAgICogc2V0dGluZ3MgdXNlZCBieSBhbGwgbW9kZWxzLiBOb3RlIHRoYXQgdGhlIHByb3ZpZGVyIGlzIGF2YWlsYWJsZVxuICAgKiB0byBDb25maWd1cmF0aW9uIEJsb2NrcyBvbmx5LCBzZWVcbiAgICoge0BsaW5rIGh0dHBzOi8vZG9jcy5hbmd1bGFyanMub3JnL2d1aWRlL21vZHVsZSNtb2R1bGUtbG9hZGluZy1kZXBlbmRlbmNpZXMgTW9kdWxlIExvYWRpbmcgJiBEZXBlbmRlbmNpZXN9XG4gICAqIGZvciBtb3JlIGRldGFpbHMuXG4gICAqXG4gICAqICMjIEV4YW1wbGVcbiAgICpcbiAgICogYGBganNcbiAgICogYW5ndWxhci5tb2R1bGUoJ2FwcCcpXG4gICAqICAuY29uZmlnKGZ1bmN0aW9uKExvb3BCYWNrUmVzb3VyY2VQcm92aWRlcikge1xuICAgKiAgICAgTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyLnNldEF1dGhIZWFkZXIoJ1gtQWNjZXNzLVRva2VuJyk7XG4gICAqICB9KTtcbiAgICogYGBgXG4gICAqL1xuICAucHJvdmlkZXIoJ0xvb3BCYWNrUmVzb3VyY2UnLCBmdW5jdGlvbiBMb29wQmFja1Jlc291cmNlUHJvdmlkZXIoKSB7XG4gICAgLyoqXG4gICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAqIEBuYW1lIGxiU2VydmljZXMuTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyI3NldEF1dGhIZWFkZXJcbiAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Mb29wQmFja1Jlc291cmNlUHJvdmlkZXJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaGVhZGVyIFRoZSBoZWFkZXIgbmFtZSB0byB1c2UsIGUuZy4gYFgtQWNjZXNzLVRva2VuYFxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIENvbmZpZ3VyZSB0aGUgUkVTVCB0cmFuc3BvcnQgdG8gdXNlIGEgZGlmZmVyZW50IGhlYWRlciBmb3Igc2VuZGluZ1xuICAgICAqIHRoZSBhdXRoZW50aWNhdGlvbiB0b2tlbi4gSXQgaXMgc2VudCBpbiB0aGUgYEF1dGhvcml6YXRpb25gIGhlYWRlclxuICAgICAqIGJ5IGRlZmF1bHQuXG4gICAgICovXG4gICAgdGhpcy5zZXRBdXRoSGVhZGVyID0gZnVuY3Rpb24oaGVhZGVyKSB7XG4gICAgICBhdXRoSGVhZGVyID0gaGVhZGVyO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Mb29wQmFja1Jlc291cmNlUHJvdmlkZXIjc2V0VXJsQmFzZVxuICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkxvb3BCYWNrUmVzb3VyY2VQcm92aWRlclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIFVSTCB0byB1c2UsIGUuZy4gYC9hcGlgIG9yIGAvL2V4YW1wbGUuY29tL2FwaWAuXG4gICAgICogQGRlc2NyaXB0aW9uXG4gICAgICogQ2hhbmdlIHRoZSBVUkwgb2YgdGhlIFJFU1QgQVBJIHNlcnZlci4gQnkgZGVmYXVsdCwgdGhlIFVSTCBwcm92aWRlZFxuICAgICAqIHRvIHRoZSBjb2RlIGdlbmVyYXRvciAoYGxiLW5nYCBvciBgZ3J1bnQtbG9vcGJhY2stc2RrLWFuZ3VsYXJgKSBpcyB1c2VkLlxuICAgICAqL1xuICAgIHRoaXMuc2V0VXJsQmFzZSA9IGZ1bmN0aW9uKHVybCkge1xuICAgICAgdXJsQmFzZSA9IHVybDtcbiAgICB9O1xuXG4gICAgdGhpcy4kZ2V0ID0gWyckcmVzb3VyY2UnLCBmdW5jdGlvbigkcmVzb3VyY2UpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbih1cmwsIHBhcmFtcywgYWN0aW9ucykge1xuICAgICAgICB2YXIgcmVzb3VyY2UgPSAkcmVzb3VyY2UodXJsLCBwYXJhbXMsIGFjdGlvbnMpO1xuXG4gICAgICAgIC8vIEFuZ3VsYXIgYWx3YXlzIGNhbGxzIFBPU1Qgb24gJHNhdmUoKVxuICAgICAgICAvLyBUaGlzIGhhY2sgaXMgYmFzZWQgb25cbiAgICAgICAgLy8gaHR0cDovL2tpcmtidXNoZWxsLm1lL2FuZ3VsYXItanMtdXNpbmctbmctcmVzb3VyY2UtaW4tYS1tb3JlLXJlc3RmdWwtbWFubmVyL1xuICAgICAgICByZXNvdXJjZS5wcm90b3R5cGUuJHNhdmUgPSBmdW5jdGlvbihzdWNjZXNzLCBlcnJvcikge1xuICAgICAgICAgIC8vIEZvcnR1bmF0ZWx5LCBMb29wQmFjayBwcm92aWRlcyBhIGNvbnZlbmllbnQgYHVwc2VydGAgbWV0aG9kXG4gICAgICAgICAgLy8gdGhhdCBleGFjdGx5IGZpdHMgb3VyIG5lZWRzLlxuICAgICAgICAgIHZhciByZXN1bHQgPSByZXNvdXJjZS51cHNlcnQuY2FsbCh0aGlzLCB7fSwgdGhpcywgc3VjY2VzcywgZXJyb3IpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQuJHByb21pc2UgfHwgcmVzdWx0O1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gcmVzb3VyY2U7XG4gICAgICB9O1xuICAgIH1dO1xuICB9KTtcblxufSkod2luZG93LCB3aW5kb3cuYW5ndWxhcik7XG4iLCJhcHAuc2VydmljZSgnWG9sYVNlcnZpY2UnLCBmdW5jdGlvbigkaW5qZWN0b3IpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciBldmVudHMgPSBbXG4gICAgXCJBY3Rpb24gU3BvcnRzIFRyYWluaW5nXCIsXG4gICAgXCJBZXJpYWwgVG91cnNcIixcbiAgICBcIkFyY2hhZW9sb2d5XCIsXG4gICAgXCJBcnQgJiBBcmNoaXRlY3R1cmVcIixcbiAgICBcIkJhY2twYWNraW5nL0NhbXBpbmdcIixcbiAgICBcIkJhbGxvb25pbmdcIixcbiAgICBcIkJlZXIgVG91clwiLFxuICAgIFwiQmlyZHdhdGNoaW5nXCIsXG4gICAgXCJCdW5nZWUgSnVtcGluZ1wiLFxuICAgIFwiQ2FueW9uaW5nXCIsXG4gICAgXCJDYXZpbmcgLyBTcGVsdW5raW5nXCIsXG4gICAgXCJDcmVhdGl2ZSBDbGFzc2VzXCIsXG4gICAgXCJDcm9zcyBDb3VudHJ5IFNraWluZ1wiLFxuICAgIFwiQ3VsdHVyZSAmIEhpc3RvcnlcIixcbiAgICBcIkN5Y2xpbmcgJiBNb3VudGFpbiBCaWtpbmdcIixcbiAgICBcIkRlZXAgU2VhIEZpc2hpbmdcIixcbiAgICBcIkRvZyBTbGVkZGluZ1wiLFxuICAgIFwiRWNvLVRvdXIvSGlrZVwiLFxuICAgIFwiRmlsbSBTY3JlZW5pbmdcIixcbiAgICBcIkZseSBGaXNoaW5nXCIsXG4gICAgXCJGb29kICYgV2luZVwiLFxuICAgIFwiR2xpZGVyc1wiLFxuICAgIFwiR3VpZGUgU2Nob29sXCIsXG4gICAgXCJIYW5nIEdsaWRpbmcgXCIsXG4gICAgXCJIZWxpLXNraWluZ1wiLFxuICAgIFwiSGVsaWNvcHRlciBUb3Vyc1wiLFxuICAgIFwiSG9yc2ViYWNrIFJpZGluZ1wiLFxuICAgIFwiSG91c2Vib2F0c1wiLFxuICAgIFwiS2F5YWtpbmcgJiBDYW5vZWluZ1wiLFxuICAgIFwiTGFrZSBGaXNoaW5nXCIsXG4gICAgXCJNYXJpbmUgV2lsZGxpZmVcIixcbiAgICBcIk1vdG9yIFlhY2h0XCIsXG4gICAgXCJNb3VudGFpbmVlcmluZ1wiLFxuICAgIFwiTXVzaWMvUmFmdGluZyBmZXN0aXZhbFwiLFxuICAgIFwiT2NlYW4gQ3J1aXNlc1wiLFxuICAgIFwiT2ZmLXJvYWRcIixcbiAgICBcIlBhcmFjaHV0aW5nXCIsXG4gICAgXCJQYXJhZ2xpZGluZ1wiLFxuICAgIFwiUGhvdG9ncmFwaHlcIixcbiAgICBcIlByaXZhdGUgSmV0IFRvdXJzXCIsXG4gICAgXCJSaXZlciBDcnVpc2VzXCIsXG4gICAgXCJSaXZlciBSYWZ0aW5nXCIsXG4gICAgXCJSaXZlciBUdWJpbmcgXCIsXG4gICAgXCJSb2NrIENsaW1iaW5nXCIsXG4gICAgXCJTYWZldHkgVHJhaW5pbmdcIixcbiAgICBcIlNhaWxpbmdcIixcbiAgICBcIlNjdWJhICYgU25vcmtlbGluZ1wiLFxuICAgIFwiU2tpIFRvdXJzXCIsXG4gICAgXCJTa2lpbmcgXCIsXG4gICAgXCJTa3lkaXZpbmdcIixcbiAgICBcIlNsZWlnaCBSaWRpbmdcIixcbiAgICBcIlNub3cgVHViaW5nXCIsXG4gICAgXCJTbm93Y2F0IFNraWluZ1wiLFxuICAgIFwiU25vd2tpdGluZ1wiLFxuICAgIFwiU25vd21vYmlsaW5nXCIsXG4gICAgXCJTbm93c2hvZWluZ1wiLFxuICAgIFwiU3RhbmQgVXAgUGFkZGxlIChTVVApXCIsXG4gICAgXCJTdXJmaW5nXCIsXG4gICAgXCJUZWFtIEJ1aWxkaW5nXCIsXG4gICAgXCJUb3VyaXNtICYgVGVjaG5vbG9neSBTdW1taXRcIixcbiAgICBcIlRyZWtraW5nIC8gSGlraW5nXCIsXG4gICAgXCJWb2x1bnRlZXJpbmdcIixcbiAgICBcIldha2Vib2FyZGluZ1wiLFxuICAgIFwiV2Fsa2luZyBUb3Vyc1wiLFxuICAgIFwiV2Vic2l0ZSBDcmVhdGlvblwiLFxuICAgIFwiV2lsZGVybmVzcyBUcmFpbmluZ1wiLFxuICAgIFwiV2lsZGxpZmUgU2FmYXJpc1wiLFxuICAgIFwiV2luZHN1cmZpbmcgJiBLaXRlc3VyZmluZ1wiLFxuICAgIFwiWmlwLWxpbmluZ1wiXG4gIF07XG5cbiAgdmFyIGV4cG9ydHMgPSB7fTtcbiAgZXhwb3J0cy5mZXRjaCA9IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIGV2ZW50cztcbiAgfTtcblxuXG4gIHJldHVybiBleHBvcnRzO1xufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
