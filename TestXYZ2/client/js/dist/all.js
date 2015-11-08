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
      .state('digests', {
        url: '/digests',
        templateUrl: 'js/templates/digests/index.html',
        controller: 'DigestCtrl'
      })
      .state('workflow', {
        url: '/digests/:id',
        templateUrl: 'js/templates/digests/workflow.html',
        controller: 'DigestWorkflowCtrl'
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
app.controller('DigestCtrl', function($scope, $injector) {
  'use strict';

  var
    DigestService = $injector.get('DigestService'),
    DigestModel = $injector.get('Digest'),
    $mdDialog = $injector.get('$mdDialog'),
    $mdToast = $injector.get('$mdToast');

  $scope.search = function() {
    $scope.deferred = DigestService.fetch()
      .then(function(response) {
        $scope.digests = response.digests;
        $scope.total = response.total;

        if(!$scope.digests.length){
          $scope.add(angular.element(document));
        }
      });
  };

  $scope.add = function(){
    DigestService.add.apply(DigestService, arguments)
      .then(function(){
        $scope.search();
        $mdToast.show($mdToast.simple().content('Digest saved'));
      });
  };

  $scope.trigger = function(type, index, ev){
    var digest = angular.copy($scope.digests[index]);
    switch(type){
      case 'save':
        DigestModel
          .upsert(digest, function(){
            $mdToast.show($mdToast.simple().content('Digest updated'));
          })
        break;

      case 'delete':
        DigestService.remove(ev, digest)
          .then(function(){
            $scope.digests.splice(index, 1);
            $mdToast.show($mdToast.simple().content('Digest deleted'));
          })
        break;
    }
  };

  $scope.search();
});
app.controller('DigestWorkflowCtrl', function($scope, $injector, $state) {
  'use strict';

  var
    $mdToast = $injector.get('$mdToast'),
    helperService = $injector.get('helper'),
    DigestModel = $injector.get('Digest'),
    DigestService = $injector.get('DigestService'),
    PostService = $injector.get('PostService');

  DigestService.find($state.params.id)
    .then(function(digest) {
      $scope.digest = digest;
      $scope.findPosts(digest.posts);

      $scope.$watch('digest', function(n, o){
        if(n === o){ return false; }
        DigestModel
          .upsert(digest, function(){
            $mdToast.show($mdToast.simple().content('Digest updated'));
          })
      }, true);

    });

  $scope.library = function(ev){
    PostService.library(ev, $scope.digest)
      .then(function(selctedPosts){

        angular.forEach(selctedPosts, function(id){
          if($scope.digest.posts.indexOf(id) === -1){
            $scope.digest.posts.push(id);
          }
        });

        $scope.findPosts($scope.digest.posts);
      });
  };

  var watcherFn;
  $scope.findPosts = function(ids){
    if(!ids || !ids.length){
      return false;
    }

    PostService.findByIds(ids)
      .then(function(posts){
        if(angular.isFunction(watcherFn)){
          watcherFn();
        }

        // shuffle the posts in the order
        // they in the digest.posts
        if($scope.digest.posts.length) {
          var sortedPosts = [];
          angular.forEach(posts, function(post) {
            sortedPosts[$scope.digest.posts.indexOf(post.id.toString())] = post;
          });
          $scope.posts = sortedPosts;
        }else{
          $scope.posts = posts;
        }

        watcherFn = $scope.$watch('posts', function(posts, old) {
          var sortedPosts = [];
          angular.forEach(posts, function(post){
            sortedPosts.push(post.id.toString());
          });
          if(helperService.isArrayEqual(sortedPosts, $scope.digest.posts)){ return false; }
          $scope.digest.posts = sortedPosts;
        }, true);
      });
  };

  $scope.removePost = function(index){
    $scope.digest.posts.splice(index, 1);
    $scope.posts.splice(index, 1);
  };
});
app.controller('HomeCtrl', function($scope, uiGmapGoogleMapApi, $injector){
  var $mdDialog = $injector.get('$mdDialog');
  var XolaService = $injector.get('XolaService');
  $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };

  $scope.trip = {
    price: 100
  };

  uiGmapGoogleMapApi.then(function(maps) {
    //console.info(maps);
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

        $scope.selected = {
          offer: {
            index: null
          },
          interests: {}
        };


        $scope.selectOffer = function(index){
          $scope.selected.offer.index = index;
          $scope.selectedTab = 1;
        };

        $scope.interests = XolaService.getEvents();

        $scope.next = function(){
          $scope.selectedTab++;
        };

      },
      locals: { price: $scope.trip.price },
      templateUrl: 'js/templates/start-modal.html',
      parent: angular.element(document.body),
      targetEvent: ev
    });
  }

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
  exports.getEvents = function(){
    return events;
  };


  return exports;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImNvbnRyb2xsZXJzL2RpYWxvZ0N0cmwuanMiLCJjb250cm9sbGVycy9kaWdlc3RDdHJsLmpzIiwiY29udHJvbGxlcnMvZGlnZXN0V29ya2Zsb3dDdHJsLmpzIiwiY29udHJvbGxlcnMvaG9tZUN0cmwuanMiLCJjb250cm9sbGVycy93b3Jrc3BhY2VDdHJsLmpzIiwic2VydmljZXMvaGVscGVyU2VydmljZS5qcyIsInNlcnZpY2VzL2xiLXNlcnZpY2VzLmpzIiwic2VydmljZXMveG9sYVNlcnZpY2UuanMiLCJkaXJlY3RpdmVzL3ByaWNlLXNlbGVjdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdmlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImFsbC5qcyIsInNvdXJjZXNDb250ZW50IjpbInZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnQXBwJywgW1xuICAnbGJTZXJ2aWNlcycsICd1aS5yb3V0ZXInLCAnc3ByaW50ZicsICduZ01hdGVyaWFsJywgJ21kLmRhdGEudGFibGUnLCAnbWREYXRlVGltZScsICduZ1Nhbml0aXplJywgJ3VpR21hcGdvb2dsZS1tYXBzJ1xuXSlcbiAgLmNvbnN0YW50KCdjb25maWdTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlcnZlcnMgPSB7XG4gICAgICAgICdhcGknOiB7XG4gICAgICAgICAgJ2Rldic6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXBpJyxcbiAgICAgICAgICAncHJvZHVjdGlvbic6ICdodHRwOi8vZWMyLTU0LTE2NC0xMDAtMjA4LmNvbXB1dGUtMS5hbWF6b25hd3MuY29tOjMwMDAvYXBpJ1xuICAgICAgICB9LFxuICAgICAgICAnaW1hZ2UnOiB7XG4gICAgICAgICAgJ2Rldic6ICdodHRwOi8vbG9jYWxob3N0OjMwMzAnLFxuICAgICAgICAgICdwcm9kdWN0aW9uJzogJ2h0dHA6Ly9lYzItNTQtMTY0LTEwMC0yMDguY29tcHV0ZS0xLmFtYXpvbmF3cy5jb206MzAzMCdcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLCBFTlYgPSAnZGV2JztcblxuICAgIC8qKlxuICAgICAqIGdldCB0aGUgc2VydmVyIG5hbWVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSBmb3IgdGhlIHNlcnZlclxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gVVJMIG9mIHRoZSBzZXJ2ZXJcbiAgICAgKi9cbiAgICB0aGlzLmdldCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgIHJldHVybiBzZXJ2ZXJzW3R5cGVdW3RoaXMuZ2V0RW52KCldO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IGRldiAvIHByb2R1Y3Rpb24gZW52aXJvbm1lbnRcbiAgICAgKi9cbiAgICB0aGlzLmdldEVudiA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEVOVjtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0oKSlcblxuICAuY29uZmlnKGZ1bmN0aW9uKExvb3BCYWNrUmVzb3VyY2VQcm92aWRlciwgY29uZmlnU2VydmljZSkge1xuICAgIC8vIFVzZSBhIGN1c3RvbSBhdXRoIGhlYWRlciBpbnN0ZWFkIG9mIHRoZSBkZWZhdWx0ICdBdXRob3JpemF0aW9uJ1xuICAgIExvb3BCYWNrUmVzb3VyY2VQcm92aWRlci5zZXRBdXRoSGVhZGVyKCdYLUFjY2Vzcy1Ub2tlbicpO1xuXG4gICAgLy8gQ2hhbmdlIHRoZSBVUkwgd2hlcmUgdG8gYWNjZXNzIHRoZSBMb29wQmFjayBSRVNUIEFQSSBzZXJ2ZXJcbiAgICBMb29wQmFja1Jlc291cmNlUHJvdmlkZXIuc2V0VXJsQmFzZShjb25maWdTZXJ2aWNlLmdldCgnYXBpJykpO1xuICB9KVxuICAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyLCAkdXJsUm91dGVyUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlclxuICAgICAgLnN0YXRlKCdob21lJywge1xuICAgICAgICB1cmw6ICcvaG9tZScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvdGVtcGxhdGVzL2hvbWUuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdIb21lQ3RybCdcbiAgICAgIH0pXG4gICAgICAuc3RhdGUoJ2RpZ2VzdHMnLCB7XG4gICAgICAgIHVybDogJy9kaWdlc3RzJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvZGlnZXN0cy9pbmRleC5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0RpZ2VzdEN0cmwnXG4gICAgICB9KVxuICAgICAgLnN0YXRlKCd3b3JrZmxvdycsIHtcbiAgICAgICAgdXJsOiAnL2RpZ2VzdHMvOmlkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvZGlnZXN0cy93b3JrZmxvdy5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0RpZ2VzdFdvcmtmbG93Q3RybCdcbiAgICAgIH0pO1xuXG4gICAgLy8gaWYgbm9uZSBvZiB0aGUgYWJvdmUgc3RhdGVzIGFyZSBtYXRjaGVkLCB1c2UgdGhpcyBhcyB0aGUgZmFsbGJhY2tcbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvaG9tZScpO1xuICB9KVxuICAuY29uZmlnKGZ1bmN0aW9uKCRtZFRoZW1pbmdQcm92aWRlciwgJG1kSWNvblByb3ZpZGVyKSB7XG4gICAgJG1kVGhlbWluZ1Byb3ZpZGVyLnRoZW1lKCdkZWZhdWx0Jyk7XG5cbiAgICAkbWRJY29uUHJvdmlkZXJcbiAgICAgIC5kZWZhdWx0SWNvblNldCgnL2Jvd2VyX2NvbXBvbmVudHMvYW5ndWxhci1tYXRlcmlhbC9kZW1vcy9pY29uL2RlbW9TdmdJY29uU2V0cy9hc3NldHMvY29yZS1pY29ucy5zdmcnLCAyNCk7XG5cbiAgfSlcblxuICAucnVuKGZ1bmN0aW9uKCkge1xuICAgIGFuZ3VsYXIuc3ByaW50ZiA9IGFuZ3VsYXIuc3ByaW50ZiB8fCB3aW5kb3cuc3ByaW50ZiB8fCBmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfTtcbiAgfSk7XG4iLCJhcHAuY29udHJvbGxlcignRGlhbG9nQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgJG1kRGlhbG9nKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAkc2NvcGUuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gICAgJG1kRGlhbG9nLmNhbmNlbCgpO1xuICB9O1xufSk7IiwiYXBwLmNvbnRyb2xsZXIoJ0RpZ2VzdEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRpbmplY3Rvcikge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyXG4gICAgRGlnZXN0U2VydmljZSA9ICRpbmplY3Rvci5nZXQoJ0RpZ2VzdFNlcnZpY2UnKSxcbiAgICBEaWdlc3RNb2RlbCA9ICRpbmplY3Rvci5nZXQoJ0RpZ2VzdCcpLFxuICAgICRtZERpYWxvZyA9ICRpbmplY3Rvci5nZXQoJyRtZERpYWxvZycpLFxuICAgICRtZFRvYXN0ID0gJGluamVjdG9yLmdldCgnJG1kVG9hc3QnKTtcblxuICAkc2NvcGUuc2VhcmNoID0gZnVuY3Rpb24oKSB7XG4gICAgJHNjb3BlLmRlZmVycmVkID0gRGlnZXN0U2VydmljZS5mZXRjaCgpXG4gICAgICAudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAkc2NvcGUuZGlnZXN0cyA9IHJlc3BvbnNlLmRpZ2VzdHM7XG4gICAgICAgICRzY29wZS50b3RhbCA9IHJlc3BvbnNlLnRvdGFsO1xuXG4gICAgICAgIGlmKCEkc2NvcGUuZGlnZXN0cy5sZW5ndGgpe1xuICAgICAgICAgICRzY29wZS5hZGQoYW5ndWxhci5lbGVtZW50KGRvY3VtZW50KSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9O1xuXG4gICRzY29wZS5hZGQgPSBmdW5jdGlvbigpe1xuICAgIERpZ2VzdFNlcnZpY2UuYWRkLmFwcGx5KERpZ2VzdFNlcnZpY2UsIGFyZ3VtZW50cylcbiAgICAgIC50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICAgICRzY29wZS5zZWFyY2goKTtcbiAgICAgICAgJG1kVG9hc3Quc2hvdygkbWRUb2FzdC5zaW1wbGUoKS5jb250ZW50KCdEaWdlc3Qgc2F2ZWQnKSk7XG4gICAgICB9KTtcbiAgfTtcblxuICAkc2NvcGUudHJpZ2dlciA9IGZ1bmN0aW9uKHR5cGUsIGluZGV4LCBldil7XG4gICAgdmFyIGRpZ2VzdCA9IGFuZ3VsYXIuY29weSgkc2NvcGUuZGlnZXN0c1tpbmRleF0pO1xuICAgIHN3aXRjaCh0eXBlKXtcbiAgICAgIGNhc2UgJ3NhdmUnOlxuICAgICAgICBEaWdlc3RNb2RlbFxuICAgICAgICAgIC51cHNlcnQoZGlnZXN0LCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgJG1kVG9hc3Quc2hvdygkbWRUb2FzdC5zaW1wbGUoKS5jb250ZW50KCdEaWdlc3QgdXBkYXRlZCcpKTtcbiAgICAgICAgICB9KVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnZGVsZXRlJzpcbiAgICAgICAgRGlnZXN0U2VydmljZS5yZW1vdmUoZXYsIGRpZ2VzdClcbiAgICAgICAgICAudGhlbihmdW5jdGlvbigpe1xuICAgICAgICAgICAgJHNjb3BlLmRpZ2VzdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgICRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKCkuY29udGVudCgnRGlnZXN0IGRlbGV0ZWQnKSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9O1xuXG4gICRzY29wZS5zZWFyY2goKTtcbn0pOyIsImFwcC5jb250cm9sbGVyKCdEaWdlc3RXb3JrZmxvd0N0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRpbmplY3RvciwgJHN0YXRlKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXJcbiAgICAkbWRUb2FzdCA9ICRpbmplY3Rvci5nZXQoJyRtZFRvYXN0JyksXG4gICAgaGVscGVyU2VydmljZSA9ICRpbmplY3Rvci5nZXQoJ2hlbHBlcicpLFxuICAgIERpZ2VzdE1vZGVsID0gJGluamVjdG9yLmdldCgnRGlnZXN0JyksXG4gICAgRGlnZXN0U2VydmljZSA9ICRpbmplY3Rvci5nZXQoJ0RpZ2VzdFNlcnZpY2UnKSxcbiAgICBQb3N0U2VydmljZSA9ICRpbmplY3Rvci5nZXQoJ1Bvc3RTZXJ2aWNlJyk7XG5cbiAgRGlnZXN0U2VydmljZS5maW5kKCRzdGF0ZS5wYXJhbXMuaWQpXG4gICAgLnRoZW4oZnVuY3Rpb24oZGlnZXN0KSB7XG4gICAgICAkc2NvcGUuZGlnZXN0ID0gZGlnZXN0O1xuICAgICAgJHNjb3BlLmZpbmRQb3N0cyhkaWdlc3QucG9zdHMpO1xuXG4gICAgICAkc2NvcGUuJHdhdGNoKCdkaWdlc3QnLCBmdW5jdGlvbihuLCBvKXtcbiAgICAgICAgaWYobiA9PT0gbyl7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICBEaWdlc3RNb2RlbFxuICAgICAgICAgIC51cHNlcnQoZGlnZXN0LCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgJG1kVG9hc3Quc2hvdygkbWRUb2FzdC5zaW1wbGUoKS5jb250ZW50KCdEaWdlc3QgdXBkYXRlZCcpKTtcbiAgICAgICAgICB9KVxuICAgICAgfSwgdHJ1ZSk7XG5cbiAgICB9KTtcblxuICAkc2NvcGUubGlicmFyeSA9IGZ1bmN0aW9uKGV2KXtcbiAgICBQb3N0U2VydmljZS5saWJyYXJ5KGV2LCAkc2NvcGUuZGlnZXN0KVxuICAgICAgLnRoZW4oZnVuY3Rpb24oc2VsY3RlZFBvc3RzKXtcblxuICAgICAgICBhbmd1bGFyLmZvckVhY2goc2VsY3RlZFBvc3RzLCBmdW5jdGlvbihpZCl7XG4gICAgICAgICAgaWYoJHNjb3BlLmRpZ2VzdC5wb3N0cy5pbmRleE9mKGlkKSA9PT0gLTEpe1xuICAgICAgICAgICAgJHNjb3BlLmRpZ2VzdC5wb3N0cy5wdXNoKGlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRzY29wZS5maW5kUG9zdHMoJHNjb3BlLmRpZ2VzdC5wb3N0cyk7XG4gICAgICB9KTtcbiAgfTtcblxuICB2YXIgd2F0Y2hlckZuO1xuICAkc2NvcGUuZmluZFBvc3RzID0gZnVuY3Rpb24oaWRzKXtcbiAgICBpZighaWRzIHx8ICFpZHMubGVuZ3RoKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBQb3N0U2VydmljZS5maW5kQnlJZHMoaWRzKVxuICAgICAgLnRoZW4oZnVuY3Rpb24ocG9zdHMpe1xuICAgICAgICBpZihhbmd1bGFyLmlzRnVuY3Rpb24od2F0Y2hlckZuKSl7XG4gICAgICAgICAgd2F0Y2hlckZuKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzaHVmZmxlIHRoZSBwb3N0cyBpbiB0aGUgb3JkZXJcbiAgICAgICAgLy8gdGhleSBpbiB0aGUgZGlnZXN0LnBvc3RzXG4gICAgICAgIGlmKCRzY29wZS5kaWdlc3QucG9zdHMubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIHNvcnRlZFBvc3RzID0gW107XG4gICAgICAgICAgYW5ndWxhci5mb3JFYWNoKHBvc3RzLCBmdW5jdGlvbihwb3N0KSB7XG4gICAgICAgICAgICBzb3J0ZWRQb3N0c1skc2NvcGUuZGlnZXN0LnBvc3RzLmluZGV4T2YocG9zdC5pZC50b1N0cmluZygpKV0gPSBwb3N0O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgICRzY29wZS5wb3N0cyA9IHNvcnRlZFBvc3RzO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAkc2NvcGUucG9zdHMgPSBwb3N0cztcbiAgICAgICAgfVxuXG4gICAgICAgIHdhdGNoZXJGbiA9ICRzY29wZS4kd2F0Y2goJ3Bvc3RzJywgZnVuY3Rpb24ocG9zdHMsIG9sZCkge1xuICAgICAgICAgIHZhciBzb3J0ZWRQb3N0cyA9IFtdO1xuICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChwb3N0cywgZnVuY3Rpb24ocG9zdCl7XG4gICAgICAgICAgICBzb3J0ZWRQb3N0cy5wdXNoKHBvc3QuaWQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaWYoaGVscGVyU2VydmljZS5pc0FycmF5RXF1YWwoc29ydGVkUG9zdHMsICRzY29wZS5kaWdlc3QucG9zdHMpKXsgcmV0dXJuIGZhbHNlOyB9XG4gICAgICAgICAgJHNjb3BlLmRpZ2VzdC5wb3N0cyA9IHNvcnRlZFBvc3RzO1xuICAgICAgICB9LCB0cnVlKTtcbiAgICAgIH0pO1xuICB9O1xuXG4gICRzY29wZS5yZW1vdmVQb3N0ID0gZnVuY3Rpb24oaW5kZXgpe1xuICAgICRzY29wZS5kaWdlc3QucG9zdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAkc2NvcGUucG9zdHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgfTtcbn0pOyIsImFwcC5jb250cm9sbGVyKCdIb21lQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgdWlHbWFwR29vZ2xlTWFwQXBpLCAkaW5qZWN0b3Ipe1xuICB2YXIgJG1kRGlhbG9nID0gJGluamVjdG9yLmdldCgnJG1kRGlhbG9nJyk7XG4gIHZhciBYb2xhU2VydmljZSA9ICRpbmplY3Rvci5nZXQoJ1hvbGFTZXJ2aWNlJyk7XG4gICRzY29wZS5tYXAgPSB7IGNlbnRlcjogeyBsYXRpdHVkZTogNDUsIGxvbmdpdHVkZTogLTczIH0sIHpvb206IDggfTtcblxuICAkc2NvcGUudHJpcCA9IHtcbiAgICBwcmljZTogMTAwXG4gIH07XG5cbiAgdWlHbWFwR29vZ2xlTWFwQXBpLnRoZW4oZnVuY3Rpb24obWFwcykge1xuICAgIC8vY29uc29sZS5pbmZvKG1hcHMpO1xuICB9KTtcblxuICAkc2NvcGUuc3RhcnQgPSBmdW5jdGlvbihldil7XG4gICAgcmV0dXJuICRtZERpYWxvZy5zaG93KHtcbiAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJG1kRGlhbG9nLCAkY29udHJvbGxlcil7XG4gICAgICAgICRjb250cm9sbGVyKCdEaWFsb2dDb250cm9sbGVyJywge1xuICAgICAgICAgICckc2NvcGUnOiAkc2NvcGUsXG4gICAgICAgICAgJyRtZERpYWxvZyc6ICRtZERpYWxvZ1xuICAgICAgICB9KTtcbiAgICAgICAgJHNjb3BlLnNlbGVjdGVkVGFiID0gMDtcbiAgICAgICAgJHNjb3BlLm9mZmVycyA9IFtcbiAgICAgICAgICB7IHByaWNlOiAnJDI1MCd9LFxuICAgICAgICAgIHsgcHJpY2U6ICckMzUwJ30sXG4gICAgICAgICAgeyBwcmljZTogJyQ1MDAnfSxcbiAgICAgICAgICB7IHByaWNlOiAnJDc1MCd9LFxuICAgICAgICAgIHsgcHJpY2U6ICckMTAwMCd9LFxuICAgICAgICAgIHsgcHJpY2U6ICc+ICQxMDAwJ31cbiAgICAgICAgXTtcblxuICAgICAgICAkc2NvcGUuc2VsZWN0ZWQgPSB7XG4gICAgICAgICAgb2ZmZXI6IHtcbiAgICAgICAgICAgIGluZGV4OiBudWxsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnRlcmVzdHM6IHt9XG4gICAgICAgIH07XG5cblxuICAgICAgICAkc2NvcGUuc2VsZWN0T2ZmZXIgPSBmdW5jdGlvbihpbmRleCl7XG4gICAgICAgICAgJHNjb3BlLnNlbGVjdGVkLm9mZmVyLmluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgJHNjb3BlLnNlbGVjdGVkVGFiID0gMTtcbiAgICAgICAgfTtcblxuICAgICAgICAkc2NvcGUuaW50ZXJlc3RzID0gWG9sYVNlcnZpY2UuZ2V0RXZlbnRzKCk7XG5cbiAgICAgICAgJHNjb3BlLm5leHQgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICRzY29wZS5zZWxlY3RlZFRhYisrO1xuICAgICAgICB9O1xuXG4gICAgICB9LFxuICAgICAgbG9jYWxzOiB7IHByaWNlOiAkc2NvcGUudHJpcC5wcmljZSB9LFxuICAgICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvc3RhcnQtbW9kYWwuaHRtbCcsXG4gICAgICBwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcbiAgICAgIHRhcmdldEV2ZW50OiBldlxuICAgIH0pO1xuICB9XG5cbn0pOyIsImFwcC5jb250cm9sbGVyKCd3b3Jrc3BhY2VDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkc3RhdGUpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gICRzY29wZS5tZW51ID0gW1xuICAgIHtcbiAgICAgIHRpdGxlOiAnRGlnZXN0cycsXG4gICAgICBpY29uOiAndmlld19jYXJvdXNlbCcsXG4gICAgICBzdGF0ZTogJ2RpZ2VzdHMnXG4gICAgfSxcbiAgICB7XG4gICAgICB0aXRsZTogJ1Bvc3RzJyxcbiAgICAgIGljb246ICdwbGF5bGlzdF9hZGRkJyxcbiAgICAgIHN0YXRlOiAncG9zdHMnXG4gICAgfVxuICBdXG5cbiAgJHNjb3BlLmxlZnRTaWRlbmF2T3BlbiA9IGZhbHNlO1xuICAkc2NvcGUudG9nZ2xlU2lkZW5hdiA9IGZ1bmN0aW9uKCl7XG4gICAgJHNjb3BlLmxlZnRTaWRlbmF2T3BlbiA9ICEkc2NvcGUubGVmdFNpZGVuYXZPcGVuO1xuICB9XG5cbiAgJHNjb3BlLmNoYW5nZVN0YXRlID0gZnVuY3Rpb24oc3RhdGUpe1xuICAgICRzdGF0ZS5nbyhzdGF0ZSk7XG4gICAgJHNjb3BlLnRvZ2dsZVNpZGVuYXYoKTtcbiAgfVxuXG59KTsiLCJhcHAuc2VydmljZSgnaGVscGVyJywgZnVuY3Rpb24gKCRmaWx0ZXIpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICB2YXIgZXhwb3J0cyA9IHt9O1xuXG4gIGV4cG9ydHMuaXNEaXNwbGF5ID0gZnVuY3Rpb24odHlwZSl7XG4gICAgcmV0dXJuICh0eXBlID09PSAnZGlzcGxheScpO1xuICB9O1xuXG4gIGV4cG9ydHMucmVuZGVyRGF0ZUNvbHVtbiA9IGZ1bmN0aW9uIChkYXRhLCB0eXBlKSB7XG4gICAgcmV0dXJuIGV4cG9ydHMuaXNEaXNwbGF5KHR5cGUpPyAkZmlsdGVyKCdkYXRlJywgJ3Nob3J0JykoZGF0YSkgOiAnJztcbiAgfTtcblxuICBleHBvcnRzLnJlbmRlckxpbmtDb2x1bW4gPSBmdW5jdGlvbiAoZGF0YSwgdHlwZSwgZnVsbCkge1xuICAgIGlmKGV4cG9ydHMuaXNEaXNwbGF5KHR5cGUpKXtcbiAgICAgIHJldHVybiBhbmd1bGFyLnNwcmludGYoJzxhIGhyZWY9XCIjL3Bvc3RzLyUoaWQpc1wiIGRhdGEtaWQ9XCIlKGlkKXNcIj4lKHRpdGxlKXM8L2E+Jywge1xuICAgICAgICBpZDogZnVsbC5pZCxcbiAgICAgICAgdGl0bGU6IGZ1bGwudGl0bGVcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gJyc7XG4gIH07XG5cbiAgZXhwb3J0cy5pc0FycmF5RXF1YWwgPSBmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIF8uYWxsKF8uemlwKGEsIGIpLCBmdW5jdGlvbih4KSB7XG4gICAgICByZXR1cm4geFswXSA9PT0geFsxXTtcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gZXhwb3J0cztcbn0pO1xuIiwiKGZ1bmN0aW9uKHdpbmRvdywgYW5ndWxhciwgdW5kZWZpbmVkKSB7J3VzZSBzdHJpY3QnO1xuXG52YXIgdXJsQmFzZSA9IFwiL2FwaVwiO1xudmFyIGF1dGhIZWFkZXIgPSAnYXV0aG9yaXphdGlvbic7XG5cbi8qKlxuICogQG5nZG9jIG92ZXJ2aWV3XG4gKiBAbmFtZSBsYlNlcnZpY2VzXG4gKiBAbW9kdWxlXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBUaGUgYGxiU2VydmljZXNgIG1vZHVsZSBwcm92aWRlcyBzZXJ2aWNlcyBmb3IgaW50ZXJhY3Rpbmcgd2l0aFxuICogdGhlIG1vZGVscyBleHBvc2VkIGJ5IHRoZSBMb29wQmFjayBzZXJ2ZXIgdmlhIHRoZSBSRVNUIEFQSS5cbiAqXG4gKi9cbnZhciBtb2R1bGUgPSBhbmd1bGFyLm1vZHVsZShcImxiU2VydmljZXNcIiwgWyduZ1Jlc291cmNlJ10pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuVXNlclxuICogQGhlYWRlciBsYlNlcnZpY2VzLlVzZXJcbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBVc2VyYCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIlVzZXJcIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL3VzZXJzLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuZmluZEJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2ZpbmRCeUlkX19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5kZXN0cm95QnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZGVzdHJveUJ5SWRfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLnVwZGF0ZUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX3VwZGF0ZUJ5SWRfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuZmluZEJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2ZpbmRCeUlkX19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5kZXN0cm95QnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZGVzdHJveUJ5SWRfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLnVwZGF0ZUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX3VwZGF0ZUJ5SWRfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuZmluZEJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2ZpbmRCeUlkX19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5kZXN0cm95QnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZGVzdHJveUJ5SWRfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLnVwZGF0ZUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX3VwZGF0ZUJ5SWRfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2dldF9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmNyZWF0ZSgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fY3JlYXRlX19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5kZXN0cm95QWxsKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19kZWxldGVfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuY291bnQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2NvdW50X19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2dldF9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmNyZWF0ZSgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fY3JlYXRlX19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5kZXN0cm95QWxsKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19kZWxldGVfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuY291bnQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2NvdW50X19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2dldF9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmNyZWF0ZSgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fY3JlYXRlX19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5kZXN0cm95QWxsKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19kZWxldGVfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuY291bnQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2NvdW50X19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vyc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNsb2dpblxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBMb2dpbiBhIHVzZXIgd2l0aCB1c2VybmFtZS9lbWFpbCBhbmQgcGFzc3dvcmQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpbmNsdWRlYCDigJMgYHtzdHJpbmc9fWAgLSBSZWxhdGVkIG9iamVjdHMgdG8gaW5jbHVkZSBpbiB0aGUgcmVzcG9uc2UuIFNlZSB0aGUgZGVzY3JpcHRpb24gb2YgcmV0dXJuIHZhbHVlIGZvciBtb3JlIGRldGFpbHMuXG4gICAgICAgICAqICAgRGVmYXVsdCB2YWx1ZTogYHVzZXJgLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgcmVtZW1iZXJNZWAgLSBgYm9vbGVhbmAgLSBXaGV0aGVyIHRoZSBhdXRoZW50aWNhdGlvbiBjcmVkZW50aWFsc1xuICAgICAgICAgKiAgICAgc2hvdWxkIGJlIHJlbWVtYmVyZWQgaW4gbG9jYWxTdG9yYWdlIGFjcm9zcyBhcHAvYnJvd3NlciByZXN0YXJ0cy5cbiAgICAgICAgICogICAgIERlZmF1bHQ6IGB0cnVlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhlIHJlc3BvbnNlIGJvZHkgY29udGFpbnMgcHJvcGVydGllcyBvZiB0aGUgQWNjZXNzVG9rZW4gY3JlYXRlZCBvbiBsb2dpbi5cbiAgICAgICAgICogRGVwZW5kaW5nIG9uIHRoZSB2YWx1ZSBvZiBgaW5jbHVkZWAgcGFyYW1ldGVyLCB0aGUgYm9keSBtYXkgY29udGFpbiBhZGRpdGlvbmFsIHByb3BlcnRpZXM6XG4gICAgICAgICAqIFxuICAgICAgICAgKiAgIC0gYHVzZXJgIC0gYHtVc2VyfWAgLSBEYXRhIG9mIHRoZSBjdXJyZW50bHkgbG9nZ2VkIGluIHVzZXIuIChgaW5jbHVkZT11c2VyYClcbiAgICAgICAgICogXG4gICAgICAgICAqXG4gICAgICAgICAqL1xuICAgICAgICBcImxvZ2luXCI6IHtcbiAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgIGluY2x1ZGU6IFwidXNlclwiXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnRlcmNlcHRvcjoge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgIHZhciBhY2Nlc3NUb2tlbiA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICAgIExvb3BCYWNrQXV0aC5zZXRVc2VyKGFjY2Vzc1Rva2VuLmlkLCBhY2Nlc3NUb2tlbi51c2VySWQsIGFjY2Vzc1Rva2VuLnVzZXIpO1xuICAgICAgICAgICAgICBMb29wQmFja0F1dGgucmVtZW1iZXJNZSA9IHJlc3BvbnNlLmNvbmZpZy5wYXJhbXMucmVtZW1iZXJNZSAhPT0gZmFsc2U7XG4gICAgICAgICAgICAgIExvb3BCYWNrQXV0aC5zYXZlKCk7XG4gICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL2xvZ2luXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNsb2dvdXRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogTG9nb3V0IGEgdXNlciB3aXRoIGFjY2VzcyB0b2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgYWNjZXNzX3Rva2VuYCDigJMgYHtzdHJpbmd9YCAtIERvIG5vdCBzdXBwbHkgdGhpcyBhcmd1bWVudCwgaXQgaXMgYXV0b21hdGljYWxseSBleHRyYWN0ZWQgZnJvbSByZXF1ZXN0IGhlYWRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwibG9nb3V0XCI6IHtcbiAgICAgICAgICBpbnRlcmNlcHRvcjoge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgIExvb3BCYWNrQXV0aC5jbGVhclVzZXIoKTtcbiAgICAgICAgICAgICAgTG9vcEJhY2tBdXRoLmNsZWFyU3RvcmFnZSgpO1xuICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy9sb2dvdXRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2NvbmZpcm1cbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ29uZmlybSBhIHVzZXIgcmVnaXN0cmF0aW9uIHdpdGggZW1haWwgdmVyaWZpY2F0aW9uIHRva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB1aWRgIOKAkyBge3N0cmluZ31gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB0b2tlbmAg4oCTIGB7c3RyaW5nfWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHJlZGlyZWN0YCDigJMgYHtzdHJpbmc9fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb25maXJtXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy9jb25maXJtXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3Jlc2V0UGFzc3dvcmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogUmVzZXQgcGFzc3dvcmQgZm9yIGEgdXNlciB3aXRoIGVtYWlsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwicmVzZXRQYXNzd29yZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvcmVzZXRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBBY2Nlc3NUb2tlbi51c2VyKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmdldDo6YWNjZXNzVG9rZW46OnVzZXJcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWQvdXNlclwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlckNyZWRlbnRpYWwudXNlcigpIGluc3RlYWQuXG4gICAgICAgIFwiOjpnZXQ6OnVzZXJDcmVkZW50aWFsOjp1c2VyXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkL3VzZXJcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXJJZGVudGl0eS51c2VyKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmdldDo6dXNlcklkZW50aXR5Ojp1c2VyXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWQvdXNlclwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNnZXRDdXJyZW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEdldCBkYXRhIG9mIHRoZSBjdXJyZW50bHkgbG9nZ2VkIHVzZXIuIEZhaWwgd2l0aCBIVFRQIHJlc3VsdCA0MDFcbiAgICAgICAgICogd2hlbiB0aGVyZSBpcyBubyB1c2VyIGxvZ2dlZCBpbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJnZXRDdXJyZW50XCI6IHtcbiAgICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnNcIiArIFwiLzppZFwiLFxuICAgICAgICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICAgICAgIHBhcmFtczoge1xuICAgICAgICAgICAgIGlkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgdmFyIGlkID0gTG9vcEJhY2tBdXRoLmN1cnJlbnRVc2VySWQ7XG4gICAgICAgICAgICAgIGlmIChpZCA9PSBudWxsKSBpZCA9ICdfX2Fub255bW91c19fJztcbiAgICAgICAgICAgICAgcmV0dXJuIGlkO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGludGVyY2VwdG9yOiB7XG4gICAgICAgICAgICByZXNwb25zZTogZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgTG9vcEJhY2tBdXRoLmN1cnJlbnRVc2VyRGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIF9faXNHZXRDdXJyZW50VXNlcl9fIDogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2dldENhY2hlZEN1cnJlbnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogR2V0IGRhdGEgb2YgdGhlIGN1cnJlbnRseSBsb2dnZWQgdXNlciB0aGF0IHdhcyByZXR1cm5lZCBieSB0aGUgbGFzdFxuICAgICAgICAgKiBjYWxsIHRvIHtAbGluayBsYlNlcnZpY2VzLlVzZXIjbG9naW59IG9yXG4gICAgICAgICAqIHtAbGluayBsYlNlcnZpY2VzLlVzZXIjZ2V0Q3VycmVudH0uIFJldHVybiBudWxsIHdoZW4gdGhlcmVcbiAgICAgICAgICogaXMgbm8gdXNlciBsb2dnZWQgaW4gb3IgdGhlIGRhdGEgb2YgdGhlIGN1cnJlbnQgdXNlciB3ZXJlIG5vdCBmZXRjaGVkXG4gICAgICAgICAqIHlldC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQSBVc2VyIGluc3RhbmNlLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5nZXRDYWNoZWRDdXJyZW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIGRhdGEgPSBMb29wQmFja0F1dGguY3VycmVudFVzZXJEYXRhO1xuICAgICAgICAgIHJldHVybiBkYXRhID8gbmV3IFIoZGF0YSkgOiBudWxsO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNpc0F1dGhlbnRpY2F0ZWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY3VycmVudCB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQgKGxvZ2dlZCBpbikuXG4gICAgICAgICAqL1xuICAgICAgICBSLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldEN1cnJlbnRJZCgpICE9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2dldEN1cnJlbnRJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IElkIG9mIHRoZSBjdXJyZW50bHkgbG9nZ2VkLWluIHVzZXIgb3IgbnVsbC5cbiAgICAgICAgICovXG4gICAgICAgIFIuZ2V0Q3VycmVudElkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIExvb3BCYWNrQXV0aC5jdXJyZW50VXNlcklkO1xuICAgICAgICB9O1xuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuVXNlclxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBVc2VyYC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJVc2VyXCI7XG5cbiAgICAvKipcbiAgICAgKiBAbmdkb2Mgb2JqZWN0XG4gICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAqIEBvYmplY3RcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKlxuICAgICAqIFRoZSBvYmplY3QgYFVzZXIuYWNjZXNzVG9rZW5zYCBncm91cHMgbWV0aG9kc1xuICAgICAqIG1hbmlwdWxhdGluZyBgQWNjZXNzVG9rZW5gIGluc3RhbmNlcyByZWxhdGVkIHRvIGBVc2VyYC5cbiAgICAgKlxuICAgICAqIENhbGwge0BsaW5rIGxiU2VydmljZXMuVXNlciNhY2Nlc3NUb2tlbnMgVXNlci5hY2Nlc3NUb2tlbnMoKX1cbiAgICAgKiB0byBxdWVyeSBhbGwgcmVsYXRlZCBpbnN0YW5jZXMuXG4gICAgICovXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjYWNjZXNzVG9rZW5zXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFF1ZXJpZXMgYWNjZXNzVG9rZW5zIG9mIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2VucyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmdldDo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudHMgYWNjZXNzVG9rZW5zIG9mIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2Vucy5jb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmNvdW50Ojp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnMjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIGluIGFjY2Vzc1Rva2VucyBvZiB0aGlzIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zLmNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmNyZWF0ZTo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zI2Rlc3Ryb3lBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZXMgYWxsIGFjY2Vzc1Rva2VucyBvZiB0aGlzIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMuZGVzdHJveUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmRlbGV0ZTo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGFjY2Vzc1Rva2Vucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2Vucy5kZXN0cm95QnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmRlc3Ryb3lCeUlkOjp1c2VyOjphY2Nlc3NUb2tlbnNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnMjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGFjY2Vzc1Rva2Vucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMuZmluZEJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpmaW5kQnlJZDo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zI3VwZGF0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgYWNjZXNzVG9rZW5zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2Vucy51cGRhdGVCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6dXBkYXRlQnlJZDo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICAvKipcbiAgICAgKiBAbmdkb2Mgb2JqZWN0XG4gICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICogQGhlYWRlciBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgKiBAb2JqZWN0XG4gICAgICogQGRlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBUaGUgb2JqZWN0IGBVc2VyLmNyZWRlbnRpYWxzYCBncm91cHMgbWV0aG9kc1xuICAgICAqIG1hbmlwdWxhdGluZyBgVXNlckNyZWRlbnRpYWxgIGluc3RhbmNlcyByZWxhdGVkIHRvIGBVc2VyYC5cbiAgICAgKlxuICAgICAqIENhbGwge0BsaW5rIGxiU2VydmljZXMuVXNlciNjcmVkZW50aWFscyBVc2VyLmNyZWRlbnRpYWxzKCl9XG4gICAgICogdG8gcXVlcnkgYWxsIHJlbGF0ZWQgaW5zdGFuY2VzLlxuICAgICAqL1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2NyZWRlbnRpYWxzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFF1ZXJpZXMgY3JlZGVudGlhbHMgb2YgdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpnZXQ6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHMjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnRzIGNyZWRlbnRpYWxzIG9mIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzLmNvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Y291bnQ6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHMjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2UgaW4gY3JlZGVudGlhbHMgb2YgdGhpcyBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzLmNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmNyZWF0ZTo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFscyNkZXN0cm95QWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZXMgYWxsIGNyZWRlbnRpYWxzIG9mIHRoaXMgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzLmRlc3Ryb3lBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpkZWxldGU6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHMjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBjcmVkZW50aWFscy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMuZGVzdHJveUJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpkZXN0cm95QnlJZDo6dXNlcjo6Y3JlZGVudGlhbHNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFscyNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBjcmVkZW50aWFscy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzLmZpbmRCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZmluZEJ5SWQ6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHMjdXBkYXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGNyZWRlbnRpYWxzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuY3JlZGVudGlhbHMudXBkYXRlQnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OnVwZGF0ZUJ5SWQ6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICAvKipcbiAgICAgKiBAbmdkb2Mgb2JqZWN0XG4gICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgKiBAaGVhZGVyIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICogQG9iamVjdFxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqXG4gICAgICogVGhlIG9iamVjdCBgVXNlci5pZGVudGl0aWVzYCBncm91cHMgbWV0aG9kc1xuICAgICAqIG1hbmlwdWxhdGluZyBgVXNlcklkZW50aXR5YCBpbnN0YW5jZXMgcmVsYXRlZCB0byBgVXNlcmAuXG4gICAgICpcbiAgICAgKiBDYWxsIHtAbGluayBsYlNlcnZpY2VzLlVzZXIjaWRlbnRpdGllcyBVc2VyLmlkZW50aXRpZXMoKX1cbiAgICAgKiB0byBxdWVyeSBhbGwgcmVsYXRlZCBpbnN0YW5jZXMuXG4gICAgICovXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjaWRlbnRpdGllc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBRdWVyaWVzIGlkZW50aXRpZXMgb2YgdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Z2V0Ojp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllcyNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50cyBpZGVudGl0aWVzIG9mIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMuY291bnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Y291bnQ6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2UgaW4gaWRlbnRpdGllcyBvZiB0aGlzIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMuY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmNyZWF0ZTo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXMjZGVzdHJveUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZXMgYWxsIGlkZW50aXRpZXMgb2YgdGhpcyBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcy5kZXN0cm95QWxsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmRlbGV0ZTo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXMjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGlkZW50aXRpZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBpZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcy5kZXN0cm95QnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpkZXN0cm95QnlJZDo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXMjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBpZGVudGl0aWVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuaWRlbnRpdGllcy5maW5kQnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpmaW5kQnlJZDo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXMjdXBkYXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgaWRlbnRpdGllcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMudXBkYXRlQnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjp1cGRhdGVCeUlkOjp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICogQGhlYWRlciBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgQWNjZXNzVG9rZW5gIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiQWNjZXNzVG9rZW5cIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIEFjY2Vzc1Rva2VuLnVzZXIoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2dldF9fdXNlclwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZC91c2VyXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBBY2Nlc3NUb2tlbiBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuZmluZEJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZmluZEJ5SWQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmRlc3Ryb3lCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmRlc3Ryb3lCeUlkOjp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy51cGRhdGVCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OnVwZGF0ZUJ5SWQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vucy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmdldDo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmNyZWF0ZSgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpjcmVhdGU6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmRlc3Ryb3lBbGwoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZGVsZXRlOjp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmNvdW50KCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmNvdW50Ojp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYEFjY2Vzc1Rva2VuYC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJBY2Nlc3NUb2tlblwiO1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiN1c2VyXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGZXRjaGVzIGJlbG9uZ3NUbyByZWxhdGlvbiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIEFjY2Vzc1Rva2VuIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGByZWZyZXNoYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIudXNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Z2V0OjphY2Nlc3NUb2tlbjo6dXNlclwiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYFVzZXJDcmVkZW50aWFsYCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIlVzZXJDcmVkZW50aWFsXCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyQ3JlZGVudGlhbC51c2VyKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19nZXRfX3VzZXJcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWQvdXNlclwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlckNyZWRlbnRpYWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuZmluZEJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZmluZEJ5SWQ6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmRlc3Ryb3lCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmRlc3Ryb3lCeUlkOjp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy51cGRhdGVCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OnVwZGF0ZUJ5SWQ6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmdldDo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmNyZWF0ZSgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpjcmVhdGU6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvY3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmRlc3Ryb3lBbGwoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZGVsZXRlOjp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmNvdW50KCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmNvdW50Ojp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBVc2VyQ3JlZGVudGlhbGAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiVXNlckNyZWRlbnRpYWxcIjtcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjdXNlclxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmV0Y2hlcyBiZWxvbmdzVG8gcmVsYXRpb24gdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyQ3JlZGVudGlhbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgcmVmcmVzaGAg4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLnVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlclwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmdldDo6dXNlckNyZWRlbnRpYWw6OnVzZXJcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICogQGhlYWRlciBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYFVzZXJJZGVudGl0eWAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJVc2VySWRlbnRpdHlcIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlcklkZW50aXR5LnVzZXIoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2dldF9fdXNlclwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkL3VzZXJcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJJZGVudGl0eWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VySWRlbnRpdHkgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5maW5kQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpmaW5kQnlJZDo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuZGVzdHJveUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZGVzdHJveUJ5SWQ6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLnVwZGF0ZUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6dXBkYXRlQnlJZDo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Z2V0Ojp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuY3JlYXRlKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmNyZWF0ZTo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuZGVzdHJveUFsbCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpkZWxldGU6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuY291bnQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Y291bnQ6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgKiBAZGVzY3JpcHRpb25cbiAgICAqIFRoZSBuYW1lIG9mIHRoZSBtb2RlbCByZXByZXNlbnRlZCBieSB0aGlzICRyZXNvdXJjZSxcbiAgICAqIGkuZS4gYFVzZXJJZGVudGl0eWAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiVXNlcklkZW50aXR5XCI7XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSN1c2VyXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmV0Y2hlcyBiZWxvbmdzVG8gcmVsYXRpb24gdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VySWRlbnRpdHkgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHJlZnJlc2hgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi51c2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpnZXQ6OnVzZXJJZGVudGl0eTo6dXNlclwiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuUG9zdFxuICogQGhlYWRlciBsYlNlcnZpY2VzLlBvc3RcbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBQb3N0YCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIlBvc3RcIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL3Bvc3RzLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBQZXJzaXN0ZWRNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuUG9zdFxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBQb3N0YC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJQb3N0XCI7XG5cblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZVxuICogQGhlYWRlciBsYlNlcnZpY2VzLkltYWdlXG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgSW1hZ2VgIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiSW1hZ2VcIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL2ltYWdlcy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFBlcnNpc3RlZE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBJbWFnZWAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiSW1hZ2VcIjtcblxuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdFxuICogQGhlYWRlciBsYlNlcnZpY2VzLkRpZ2VzdFxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYERpZ2VzdGAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJEaWdlc3RcIixcbiAgWydMb29wQmFja1Jlc291cmNlJywgJ0xvb3BCYWNrQXV0aCcsICckaW5qZWN0b3InLCBmdW5jdGlvbihSZXNvdXJjZSwgTG9vcEJhY2tBdXRoLCAkaW5qZWN0b3IpIHtcbiAgICB2YXIgUiA9IFJlc291cmNlKFxuICAgICAgdXJsQmFzZSArIFwiL2RpZ2VzdHMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gUGVyc2lzdGVkTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBEaWdlc3RgLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIkRpZ2VzdFwiO1xuXG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG5cbm1vZHVsZVxuICAuZmFjdG9yeSgnTG9vcEJhY2tBdXRoJywgZnVuY3Rpb24oKSB7XG4gICAgdmFyIHByb3BzID0gWydhY2Nlc3NUb2tlbklkJywgJ2N1cnJlbnRVc2VySWQnXTtcbiAgICB2YXIgcHJvcHNQcmVmaXggPSAnJExvb3BCYWNrJCc7XG5cbiAgICBmdW5jdGlvbiBMb29wQmFja0F1dGgoKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICBwcm9wcy5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgc2VsZltuYW1lXSA9IGxvYWQobmFtZSk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMucmVtZW1iZXJNZSA9IHVuZGVmaW5lZDtcbiAgICAgIHRoaXMuY3VycmVudFVzZXJEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBMb29wQmFja0F1dGgucHJvdG90eXBlLnNhdmUgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciBzdG9yYWdlID0gdGhpcy5yZW1lbWJlck1lID8gbG9jYWxTdG9yYWdlIDogc2Vzc2lvblN0b3JhZ2U7XG4gICAgICBwcm9wcy5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgc2F2ZShzdG9yYWdlLCBuYW1lLCBzZWxmW25hbWVdKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBMb29wQmFja0F1dGgucHJvdG90eXBlLnNldFVzZXIgPSBmdW5jdGlvbihhY2Nlc3NUb2tlbklkLCB1c2VySWQsIHVzZXJEYXRhKSB7XG4gICAgICB0aGlzLmFjY2Vzc1Rva2VuSWQgPSBhY2Nlc3NUb2tlbklkO1xuICAgICAgdGhpcy5jdXJyZW50VXNlcklkID0gdXNlcklkO1xuICAgICAgdGhpcy5jdXJyZW50VXNlckRhdGEgPSB1c2VyRGF0YTtcbiAgICB9XG5cbiAgICBMb29wQmFja0F1dGgucHJvdG90eXBlLmNsZWFyVXNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5hY2Nlc3NUb2tlbklkID0gbnVsbDtcbiAgICAgIHRoaXMuY3VycmVudFVzZXJJZCA9IG51bGw7XG4gICAgICB0aGlzLmN1cnJlbnRVc2VyRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgTG9vcEJhY2tBdXRoLnByb3RvdHlwZS5jbGVhclN0b3JhZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByb3BzLmZvckVhY2goZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBzYXZlKHNlc3Npb25TdG9yYWdlLCBuYW1lLCBudWxsKTtcbiAgICAgICAgc2F2ZShsb2NhbFN0b3JhZ2UsIG5hbWUsIG51bGwpO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgTG9vcEJhY2tBdXRoKCk7XG5cbiAgICAvLyBOb3RlOiBMb2NhbFN0b3JhZ2UgY29udmVydHMgdGhlIHZhbHVlIHRvIHN0cmluZ1xuICAgIC8vIFdlIGFyZSB1c2luZyBlbXB0eSBzdHJpbmcgYXMgYSBtYXJrZXIgZm9yIG51bGwvdW5kZWZpbmVkIHZhbHVlcy5cbiAgICBmdW5jdGlvbiBzYXZlKHN0b3JhZ2UsIG5hbWUsIHZhbHVlKSB7XG4gICAgICB2YXIga2V5ID0gcHJvcHNQcmVmaXggKyBuYW1lO1xuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHZhbHVlID0gJyc7XG4gICAgICBzdG9yYWdlW2tleV0gPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkKG5hbWUpIHtcbiAgICAgIHZhciBrZXkgPSBwcm9wc1ByZWZpeCArIG5hbWU7XG4gICAgICByZXR1cm4gbG9jYWxTdG9yYWdlW2tleV0gfHwgc2Vzc2lvblN0b3JhZ2Vba2V5XSB8fCBudWxsO1xuICAgIH1cbiAgfSlcbiAgLmNvbmZpZyhbJyRodHRwUHJvdmlkZXInLCBmdW5jdGlvbigkaHR0cFByb3ZpZGVyKSB7XG4gICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaCgnTG9vcEJhY2tBdXRoUmVxdWVzdEludGVyY2VwdG9yJyk7XG4gIH1dKVxuICAuZmFjdG9yeSgnTG9vcEJhY2tBdXRoUmVxdWVzdEludGVyY2VwdG9yJywgWyAnJHEnLCAnTG9vcEJhY2tBdXRoJyxcbiAgICBmdW5jdGlvbigkcSwgTG9vcEJhY2tBdXRoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICAncmVxdWVzdCc6IGZ1bmN0aW9uKGNvbmZpZykge1xuXG4gICAgICAgICAgLy8gZmlsdGVyIG91dCBub24gdXJsQmFzZSByZXF1ZXN0c1xuICAgICAgICAgIGlmIChjb25maWcudXJsLnN1YnN0cigwLCB1cmxCYXNlLmxlbmd0aCkgIT09IHVybEJhc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBjb25maWc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKExvb3BCYWNrQXV0aC5hY2Nlc3NUb2tlbklkKSB7XG4gICAgICAgICAgICBjb25maWcuaGVhZGVyc1thdXRoSGVhZGVyXSA9IExvb3BCYWNrQXV0aC5hY2Nlc3NUb2tlbklkO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY29uZmlnLl9faXNHZXRDdXJyZW50VXNlcl9fKSB7XG4gICAgICAgICAgICAvLyBSZXR1cm4gYSBzdHViIDQwMSBlcnJvciBmb3IgVXNlci5nZXRDdXJyZW50KCkgd2hlblxuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gdXNlciBsb2dnZWQgaW5cbiAgICAgICAgICAgIHZhciByZXMgPSB7XG4gICAgICAgICAgICAgIGJvZHk6IHsgZXJyb3I6IHsgc3RhdHVzOiA0MDEgfSB9LFxuICAgICAgICAgICAgICBzdGF0dXM6IDQwMSxcbiAgICAgICAgICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IGZ1bmN0aW9uKCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gY29uZmlnIHx8ICRxLndoZW4oY29uZmlnKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1dKVxuXG4gIC8qKlxuICAgKiBAbmdkb2Mgb2JqZWN0XG4gICAqIEBuYW1lIGxiU2VydmljZXMuTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyXG4gICAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Mb29wQmFja1Jlc291cmNlUHJvdmlkZXJcbiAgICogQGRlc2NyaXB0aW9uXG4gICAqIFVzZSBgTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyYCB0byBjaGFuZ2UgdGhlIGdsb2JhbCBjb25maWd1cmF0aW9uXG4gICAqIHNldHRpbmdzIHVzZWQgYnkgYWxsIG1vZGVscy4gTm90ZSB0aGF0IHRoZSBwcm92aWRlciBpcyBhdmFpbGFibGVcbiAgICogdG8gQ29uZmlndXJhdGlvbiBCbG9ja3Mgb25seSwgc2VlXG4gICAqIHtAbGluayBodHRwczovL2RvY3MuYW5ndWxhcmpzLm9yZy9ndWlkZS9tb2R1bGUjbW9kdWxlLWxvYWRpbmctZGVwZW5kZW5jaWVzIE1vZHVsZSBMb2FkaW5nICYgRGVwZW5kZW5jaWVzfVxuICAgKiBmb3IgbW9yZSBkZXRhaWxzLlxuICAgKlxuICAgKiAjIyBFeGFtcGxlXG4gICAqXG4gICAqIGBgYGpzXG4gICAqIGFuZ3VsYXIubW9kdWxlKCdhcHAnKVxuICAgKiAgLmNvbmZpZyhmdW5jdGlvbihMb29wQmFja1Jlc291cmNlUHJvdmlkZXIpIHtcbiAgICogICAgIExvb3BCYWNrUmVzb3VyY2VQcm92aWRlci5zZXRBdXRoSGVhZGVyKCdYLUFjY2Vzcy1Ub2tlbicpO1xuICAgKiAgfSk7XG4gICAqIGBgYFxuICAgKi9cbiAgLnByb3ZpZGVyKCdMb29wQmFja1Jlc291cmNlJywgZnVuY3Rpb24gTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyKCkge1xuICAgIC8qKlxuICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkxvb3BCYWNrUmVzb3VyY2VQcm92aWRlciNzZXRBdXRoSGVhZGVyXG4gICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGhlYWRlciBUaGUgaGVhZGVyIG5hbWUgdG8gdXNlLCBlLmcuIGBYLUFjY2Vzcy1Ub2tlbmBcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKiBDb25maWd1cmUgdGhlIFJFU1QgdHJhbnNwb3J0IHRvIHVzZSBhIGRpZmZlcmVudCBoZWFkZXIgZm9yIHNlbmRpbmdcbiAgICAgKiB0aGUgYXV0aGVudGljYXRpb24gdG9rZW4uIEl0IGlzIHNlbnQgaW4gdGhlIGBBdXRob3JpemF0aW9uYCBoZWFkZXJcbiAgICAgKiBieSBkZWZhdWx0LlxuICAgICAqL1xuICAgIHRoaXMuc2V0QXV0aEhlYWRlciA9IGZ1bmN0aW9uKGhlYWRlcikge1xuICAgICAgYXV0aEhlYWRlciA9IGhlYWRlcjtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAqIEBuYW1lIGxiU2VydmljZXMuTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyI3NldFVybEJhc2VcbiAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Mb29wQmFja1Jlc291cmNlUHJvdmlkZXJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBVUkwgdG8gdXNlLCBlLmcuIGAvYXBpYCBvciBgLy9leGFtcGxlLmNvbS9hcGlgLlxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIENoYW5nZSB0aGUgVVJMIG9mIHRoZSBSRVNUIEFQSSBzZXJ2ZXIuIEJ5IGRlZmF1bHQsIHRoZSBVUkwgcHJvdmlkZWRcbiAgICAgKiB0byB0aGUgY29kZSBnZW5lcmF0b3IgKGBsYi1uZ2Agb3IgYGdydW50LWxvb3BiYWNrLXNkay1hbmd1bGFyYCkgaXMgdXNlZC5cbiAgICAgKi9cbiAgICB0aGlzLnNldFVybEJhc2UgPSBmdW5jdGlvbih1cmwpIHtcbiAgICAgIHVybEJhc2UgPSB1cmw7XG4gICAgfTtcblxuICAgIHRoaXMuJGdldCA9IFsnJHJlc291cmNlJywgZnVuY3Rpb24oJHJlc291cmNlKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24odXJsLCBwYXJhbXMsIGFjdGlvbnMpIHtcbiAgICAgICAgdmFyIHJlc291cmNlID0gJHJlc291cmNlKHVybCwgcGFyYW1zLCBhY3Rpb25zKTtcblxuICAgICAgICAvLyBBbmd1bGFyIGFsd2F5cyBjYWxscyBQT1NUIG9uICRzYXZlKClcbiAgICAgICAgLy8gVGhpcyBoYWNrIGlzIGJhc2VkIG9uXG4gICAgICAgIC8vIGh0dHA6Ly9raXJrYnVzaGVsbC5tZS9hbmd1bGFyLWpzLXVzaW5nLW5nLXJlc291cmNlLWluLWEtbW9yZS1yZXN0ZnVsLW1hbm5lci9cbiAgICAgICAgcmVzb3VyY2UucHJvdG90eXBlLiRzYXZlID0gZnVuY3Rpb24oc3VjY2VzcywgZXJyb3IpIHtcbiAgICAgICAgICAvLyBGb3J0dW5hdGVseSwgTG9vcEJhY2sgcHJvdmlkZXMgYSBjb252ZW5pZW50IGB1cHNlcnRgIG1ldGhvZFxuICAgICAgICAgIC8vIHRoYXQgZXhhY3RseSBmaXRzIG91ciBuZWVkcy5cbiAgICAgICAgICB2YXIgcmVzdWx0ID0gcmVzb3VyY2UudXBzZXJ0LmNhbGwodGhpcywge30sIHRoaXMsIHN1Y2Nlc3MsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0LiRwcm9taXNlIHx8IHJlc3VsdDtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHJlc291cmNlO1xuICAgICAgfTtcbiAgICB9XTtcbiAgfSk7XG5cbn0pKHdpbmRvdywgd2luZG93LmFuZ3VsYXIpO1xuIiwiYXBwLnNlcnZpY2UoJ1hvbGFTZXJ2aWNlJywgZnVuY3Rpb24oJGluamVjdG9yKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgZXZlbnRzID0gW1xuICAgIFwiQWN0aW9uIFNwb3J0cyBUcmFpbmluZ1wiLFxuICAgIFwiQWVyaWFsIFRvdXJzXCIsXG4gICAgXCJBcmNoYWVvbG9neVwiLFxuICAgIFwiQXJ0ICYgQXJjaGl0ZWN0dXJlXCIsXG4gICAgXCJCYWNrcGFja2luZy9DYW1waW5nXCIsXG4gICAgXCJCYWxsb29uaW5nXCIsXG4gICAgXCJCZWVyIFRvdXJcIixcbiAgICBcIkJpcmR3YXRjaGluZ1wiLFxuICAgIFwiQnVuZ2VlIEp1bXBpbmdcIixcbiAgICBcIkNhbnlvbmluZ1wiLFxuICAgIFwiQ2F2aW5nIC8gU3BlbHVua2luZ1wiLFxuICAgIFwiQ3JlYXRpdmUgQ2xhc3Nlc1wiLFxuICAgIFwiQ3Jvc3MgQ291bnRyeSBTa2lpbmdcIixcbiAgICBcIkN1bHR1cmUgJiBIaXN0b3J5XCIsXG4gICAgXCJDeWNsaW5nICYgTW91bnRhaW4gQmlraW5nXCIsXG4gICAgXCJEZWVwIFNlYSBGaXNoaW5nXCIsXG4gICAgXCJEb2cgU2xlZGRpbmdcIixcbiAgICBcIkVjby1Ub3VyL0hpa2VcIixcbiAgICBcIkZpbG0gU2NyZWVuaW5nXCIsXG4gICAgXCJGbHkgRmlzaGluZ1wiLFxuICAgIFwiRm9vZCAmIFdpbmVcIixcbiAgICBcIkdsaWRlcnNcIixcbiAgICBcIkd1aWRlIFNjaG9vbFwiLFxuICAgIFwiSGFuZyBHbGlkaW5nIFwiLFxuICAgIFwiSGVsaS1za2lpbmdcIixcbiAgICBcIkhlbGljb3B0ZXIgVG91cnNcIixcbiAgICBcIkhvcnNlYmFjayBSaWRpbmdcIixcbiAgICBcIkhvdXNlYm9hdHNcIixcbiAgICBcIktheWFraW5nICYgQ2Fub2VpbmdcIixcbiAgICBcIkxha2UgRmlzaGluZ1wiLFxuICAgIFwiTWFyaW5lIFdpbGRsaWZlXCIsXG4gICAgXCJNb3RvciBZYWNodFwiLFxuICAgIFwiTW91bnRhaW5lZXJpbmdcIixcbiAgICBcIk11c2ljL1JhZnRpbmcgZmVzdGl2YWxcIixcbiAgICBcIk9jZWFuIENydWlzZXNcIixcbiAgICBcIk9mZi1yb2FkXCIsXG4gICAgXCJQYXJhY2h1dGluZ1wiLFxuICAgIFwiUGFyYWdsaWRpbmdcIixcbiAgICBcIlBob3RvZ3JhcGh5XCIsXG4gICAgXCJQcml2YXRlIEpldCBUb3Vyc1wiLFxuICAgIFwiUml2ZXIgQ3J1aXNlc1wiLFxuICAgIFwiUml2ZXIgUmFmdGluZ1wiLFxuICAgIFwiUml2ZXIgVHViaW5nIFwiLFxuICAgIFwiUm9jayBDbGltYmluZ1wiLFxuICAgIFwiU2FmZXR5IFRyYWluaW5nXCIsXG4gICAgXCJTYWlsaW5nXCIsXG4gICAgXCJTY3ViYSAmIFNub3JrZWxpbmdcIixcbiAgICBcIlNraSBUb3Vyc1wiLFxuICAgIFwiU2tpaW5nIFwiLFxuICAgIFwiU2t5ZGl2aW5nXCIsXG4gICAgXCJTbGVpZ2ggUmlkaW5nXCIsXG4gICAgXCJTbm93IFR1YmluZ1wiLFxuICAgIFwiU25vd2NhdCBTa2lpbmdcIixcbiAgICBcIlNub3draXRpbmdcIixcbiAgICBcIlNub3dtb2JpbGluZ1wiLFxuICAgIFwiU25vd3Nob2VpbmdcIixcbiAgICBcIlN0YW5kIFVwIFBhZGRsZSAoU1VQKVwiLFxuICAgIFwiU3VyZmluZ1wiLFxuICAgIFwiVGVhbSBCdWlsZGluZ1wiLFxuICAgIFwiVG91cmlzbSAmIFRlY2hub2xvZ3kgU3VtbWl0XCIsXG4gICAgXCJUcmVra2luZyAvIEhpa2luZ1wiLFxuICAgIFwiVm9sdW50ZWVyaW5nXCIsXG4gICAgXCJXYWtlYm9hcmRpbmdcIixcbiAgICBcIldhbGtpbmcgVG91cnNcIixcbiAgICBcIldlYnNpdGUgQ3JlYXRpb25cIixcbiAgICBcIldpbGRlcm5lc3MgVHJhaW5pbmdcIixcbiAgICBcIldpbGRsaWZlIFNhZmFyaXNcIixcbiAgICBcIldpbmRzdXJmaW5nICYgS2l0ZXN1cmZpbmdcIixcbiAgICBcIlppcC1saW5pbmdcIlxuICBdO1xuXG4gIHZhciBleHBvcnRzID0ge307XG4gIGV4cG9ydHMuZ2V0RXZlbnRzID0gZnVuY3Rpb24oKXtcbiAgICByZXR1cm4gZXZlbnRzO1xuICB9O1xuXG5cbiAgcmV0dXJuIGV4cG9ydHM7XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoXCJwcmljZVNlbGVjdG9yXCIsIGZ1bmN0aW9uKCkge1xuICByZXR1cm4ge1xuICAgIHJlcXVpcmU6IFwibmdNb2RlbFwiLFxuICAgIHNjb3BlOiB7XG4gICAgICBwcmljZTogJz1uZ01vZGVsJ1xuICAgIH0sXG4gICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvcHJpY2Utc2VsZWN0b3IuaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24oJHNjb3BlKSB7XG5cbiAgICB9XG4gIH07XG59KTsiXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
