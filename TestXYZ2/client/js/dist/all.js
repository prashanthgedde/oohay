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
  $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };

  $scope.trip = {
    price: 100
  };

  uiGmapGoogleMapApi.then(function(maps) {
    //console.info(maps);
  });

  $scope.start = function(ev){
    return $mdDialog.show({
      controller: function($scope, $mdDialog, $controller, price){
        $controller('DialogController', {
          '$scope': $scope,
          '$mdDialog': $mdDialog
        });
        $scope.selectedTab = 0;
        $scope.offers = [
          { price: '$250', className: 'red' },
          { price: '$350', className: 'orange'  },
          { price: '$500', className: 'yellow'  },
          { price: '$750', className: 'blue'  },
          { price: '$1000', className: 'red'  },
          { price: '> $1000', className: 'orange'  }
        ];

        // select price
        $scope.selectOffer = function(offer){
          $scope.selectedTab = 1;
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
app.service('DigestService', function($injector){
  'use strict';

  var
    DigestModel = $injector.get('Digest'),
    $q = $injector.get('$q'),
    $mdDialog = $injector.get('$mdDialog'),
    $mdToast = $injector.get('$mdToast'),
    query = {
      filter: {
        order: 'published_date DESC'
      }
    };

  // in the future we may see a few built in alternate headers but in the mean time
  // you can implement your own search header and do something like
  this.fetch = function() {
    var deferred = $q.defer();
    DigestModel.count(false, function(e){

      DigestModel.find(query, function(digests){
        deferred.resolve({
          digests: angular.copy(digests),
          total: e.count
        });
      });
    });

    return deferred.promise;
  };

  this.add = function(ev, digest){
    digest = digest || {
      image: ''
    };

    return $mdDialog.show({
      controller: function($scope, $mdDialog, $controller){
        $controller('DialogController', {
          '$scope': $scope,
          '$mdDialog': $mdDialog
        });

        $scope.digest = angular.copy(digest);

        // on 'OK' btn click
        $scope.ok = function() {
          DigestModel.upsert($scope.digest, $mdDialog.hide, function(err){
            console.info(err);
          });
        };
      },
      templateUrl: 'js/templates/digests/add-modal.html',
      parent: angular.element(document.body),
      targetEvent: ev
    });
  };

  this.remove = function(ev, digest) {
    var deferred = $q.defer();
    $mdDialog.show(
      $mdDialog.confirm()
        .title('Confirm!')
        .content('Are you sure want to delete the selected Digest?')
        .ok('Confirm')
        .cancel('Cancel')
        .targetEvent(ev))
      .then(function(){
        DigestModel
          .deleteById({id: digest.id}, function(){
            deferred.resolve();
          });
      });

    return deferred.promise;
  };

  this.find = function(id){
    var deferred = $q.defer();

    DigestModel.find({
      filter: {
        where: {
          id: id
        }
      }
    }, function(digests){
      digests = angular.copy(digests);
      digests = (digests.length)? digests[0] : {};
      deferred.resolve(digests);
    });

    return deferred.promise;
  }

  return this;
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

app.service('pn_cloudinary', function($injector) {
    var photos = [],
      $http  = $injector.get('$http'),
      $q  = $injector.get('$q'),
      $mdDialog  = $injector.get('$mdDialog'),
      $timeout  = $injector.get('$timeout'),
      $http  = $injector.get('$http'),
      deferred = $q.defer();

    this.album = function(name) {
      var url = $.cloudinary.url(name, {format: 'json', type: 'list'});
      //cache bust
      url = url + "?" + Math.ceil(new Date().getTime() / 1000);

      $http
        .get(url)
        .success(function(response){
          photos = response.resources;
          deferred.resolve(photos);
        });

      return deferred.promise;
    };

    this.photos = function(name, forcedRefresh) {
      if(!forcedRefresh && photos && photos.length){
        var deferred = $q.defer();
        setTimeout(function(){
          deferred.resolve(photos);
        }, 1);
        return deferred.promise;
      }else{
        return this.album(name);
      }
    };

    this.upload = function (callback) {
      cloudinary.openUploadWidget({
          cloud_name: $.cloudinary.config().cloud_name,
          upload_preset: $.cloudinary.config().upload_preset,
          theme: 'minimal'
        }, callback);
    };

    this.library = function(ev){
      var self = this;
      return $mdDialog.show({
        controller: function($scope, $mdDialog, $controller){
          $controller('DialogController', {
            '$scope': $scope,
            '$mdDialog': $mdDialog
          });

          $scope.photos= [];
          $scope.whenLoading = false;

          $scope.isSelected = function(photo_id){
            return ($scope.selectedPhoto && photo_id && ($scope.selectedPhoto === photo_id))? 'photo-selected': '';
          };

          $scope.select = function(photo_id, e){
            $scope.selectedPhoto = photo_id;
          };

          $scope.upload = function(){
            self.upload(function(error, photos) {
              $scope.$apply(function(){
                $scope.photos = $scope.photos.concat(photos);
              })
            });
          };

          $scope.refresh = function(forcedRefresh){
            $scope.whenLoading = true;
            forcedRefresh = (angular.isDefined(forcedRefresh))? forcedRefresh : false;
            self
              .photos('myphotoalbum', forcedRefresh)
              .then(function(photos) {
                $timeout(function(){
                  $scope.whenLoading = false;
                  $scope.photos = photos;
                }, 10);
              });
          };
          // on 'OK btn click
          $scope.ok = function() {
            $mdDialog.hide($scope.selectedPhoto);
          };

          $scope.refresh();
        },
        templateUrl: 'js/templates/photo-album-modal.html',
        parent: angular.element(document.body),
        targetEvent: ev
      });
    };

    return this;
  });
  app.service('PostService', function($injector){
  'use strict';

  var
    PostModel = $injector.get('Post'),
    $mdDialog = $injector.get('$mdDialog'),
    $q = $injector.get('$q'),
    $mdToast = $injector.get('$mdToast'),
    limit = 10,
    skip = 1;

  var exports = {
    where: {}
  };

  exports.query = {
    filter: {
      order: 'published_time DESC',
      limit: limit,
      skip: skip,
      where: exports.where
    }
  };

  exports.setup = function(scope){
    scope.posts = [];
    scope.total = 0;
    scope.query = exports.query;

    scope.onOrderChange = function(){
      exports.onOrderChange.apply(self, arguments);
      scope.search();
    };

    scope.onPaginationChange = function(){
      exports.onPaginationChange.apply(self, arguments);
      scope.search();
    };

    scope.search = function() {
      scope.deferred = exports.fetch()
        .then(function(data){
          scope.posts = data.posts;
          scope.total = data.total;
        });

      return scope.deferred;
    };
  };

  exports.set = function(type, value){
    exports[type] = value;
  };

  // in the future we may see a few built in alternate headers but in the mean time
  // you can implement your own search header and do something like
  exports.fetch = function() {
    var deferred = $q.defer();
    PostModel.count(false, function(e){
      exports.query = {
        filter: {
          order: 'published_time DESC',
          limit: limit,
          skip: skip,
          where: exports.where
        }
      };

      PostModel.find(exports.query, function(posts){
        deferred.resolve({
          posts: angular.copy(posts),
          total: e.count
        });
      });
    });

    return deferred.promise;
  };

  exports.onOrderChange = function(order) {
    if(order.charAt(0) === '-'){
      exports.query.filter.order = order.substr(1, order.length-1) + ' DESC';
    }
  };

  exports.onPaginationChange = function(_skip, _limit) {
    skip = _skip;
    limit = _limit;
  };

  exports.library = function(ev, digest){
    return $mdDialog.show({
      controller: function($scope, $mdDialog, $controller, digest){
        $controller('DialogController', {
          '$scope': $scope,
          '$mdDialog': $mdDialog
        });

        $scope.where = {state: 'PUBLISHED'};
        exports.setup($scope);
        $scope.selected = [];
        $scope.parentName = 'TEST';
        $scope.init = function(){
          var currentDay = new Date(digest.published_date),
            nextDay = new Date(digest.published_date);
          nextDay.setDate(nextDay.getDate() + 1);

          exports.set('where', {
            state: 'PUBLISHED',
            published_time: {
              between: [currentDay, nextDay]
            }
          });

          $scope.search();
        };

        $scope.ok = function() {
          var posts = [];
          angular.forEach($scope.$$childTail.selected, function(post){
            posts.push(post.id.toString());
          });
          $mdDialog.hide(posts);
        };

        $scope.init();
      },
      locals: { digest: digest },
      templateUrl: 'js/templates/posts/library-modal.html',
      parent: angular.element(document.body),
      targetEvent: ev
    });
  };

  exports.findByIds = function(ids){
    var deferred = $q.defer();

    PostModel.find({
      filter: {
        where: {
          id: {
            inq: ids
          }
        }
      }
    }, function(posts){
      deferred.resolve(angular.copy(posts));
    });

    return deferred.promise;
  }

  return exports;
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImNvbnRyb2xsZXJzL2RpYWxvZ0N0cmwuanMiLCJjb250cm9sbGVycy9kaWdlc3RDdHJsLmpzIiwiY29udHJvbGxlcnMvZGlnZXN0V29ya2Zsb3dDdHJsLmpzIiwiY29udHJvbGxlcnMvaG9tZUN0cmwuanMiLCJjb250cm9sbGVycy93b3Jrc3BhY2VDdHJsLmpzIiwiZGlyZWN0aXZlcy9wcmljZS1zZWxlY3Rvci5qcyIsInNlcnZpY2VzL2RpZ2VzdFNlcnZpY2UuanMiLCJzZXJ2aWNlcy9oZWxwZXJTZXJ2aWNlLmpzIiwic2VydmljZXMvbGItc2VydmljZXMuanMiLCJzZXJ2aWNlcy9wbl9jbG91ZGluYXJ5LmpzIiwic2VydmljZXMvcG9zdFNlcnZpY2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdmlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJhbGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ0FwcCcsIFtcbiAgJ2xiU2VydmljZXMnLCAndWkucm91dGVyJywgJ3NwcmludGYnLCAnbmdNYXRlcmlhbCcsICdtZC5kYXRhLnRhYmxlJywgJ21kRGF0ZVRpbWUnLCAnbmdTYW5pdGl6ZScsICd1aUdtYXBnb29nbGUtbWFwcydcbl0pXG4gIC5jb25zdGFudCgnY29uZmlnU2VydmljZScsIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZXJ2ZXJzID0ge1xuICAgICAgICAnYXBpJzoge1xuICAgICAgICAgICdkZXYnOiAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaScsXG4gICAgICAgICAgJ3Byb2R1Y3Rpb24nOiAnaHR0cDovL2VjMi01NC0xNjQtMTAwLTIwOC5jb21wdXRlLTEuYW1hem9uYXdzLmNvbTozMDAwL2FwaSdcbiAgICAgICAgfSxcbiAgICAgICAgJ2ltYWdlJzoge1xuICAgICAgICAgICdkZXYnOiAnaHR0cDovL2xvY2FsaG9zdDozMDMwJyxcbiAgICAgICAgICAncHJvZHVjdGlvbic6ICdodHRwOi8vZWMyLTU0LTE2NC0xMDAtMjA4LmNvbXB1dGUtMS5hbWF6b25hd3MuY29tOjMwMzAnXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgICwgRU5WID0gJ2Rldic7XG5cbiAgICAvKipcbiAgICAgKiBnZXQgdGhlIHNlcnZlciBuYW1lXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgZm9yIHRoZSBzZXJ2ZXJcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IFVSTCBvZiB0aGUgc2VydmVyXG4gICAgICovXG4gICAgdGhpcy5nZXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICByZXR1cm4gc2VydmVyc1t0eXBlXVt0aGlzLmdldEVudigpXTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBkZXYgLyBwcm9kdWN0aW9uIGVudmlyb25tZW50XG4gICAgICovXG4gICAgdGhpcy5nZXRFbnYgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBFTlY7XG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9KCkpXG5cbiAgLmNvbmZpZyhmdW5jdGlvbihMb29wQmFja1Jlc291cmNlUHJvdmlkZXIsIGNvbmZpZ1NlcnZpY2UpIHtcbiAgICAvLyBVc2UgYSBjdXN0b20gYXV0aCBoZWFkZXIgaW5zdGVhZCBvZiB0aGUgZGVmYXVsdCAnQXV0aG9yaXphdGlvbidcbiAgICBMb29wQmFja1Jlc291cmNlUHJvdmlkZXIuc2V0QXV0aEhlYWRlcignWC1BY2Nlc3MtVG9rZW4nKTtcblxuICAgIC8vIENoYW5nZSB0aGUgVVJMIHdoZXJlIHRvIGFjY2VzcyB0aGUgTG9vcEJhY2sgUkVTVCBBUEkgc2VydmVyXG4gICAgTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyLnNldFVybEJhc2UoY29uZmlnU2VydmljZS5nZXQoJ2FwaScpKTtcbiAgfSlcbiAgLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlciwgJHVybFJvdXRlclByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXJcbiAgICAgIC5zdGF0ZSgnaG9tZScsIHtcbiAgICAgICAgdXJsOiAnL2hvbWUnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3RlbXBsYXRlcy9ob21lLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnSG9tZUN0cmwnXG4gICAgICB9KVxuICAgICAgLnN0YXRlKCdkaWdlc3RzJywge1xuICAgICAgICB1cmw6ICcvZGlnZXN0cycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvdGVtcGxhdGVzL2RpZ2VzdHMvaW5kZXguaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdEaWdlc3RDdHJsJ1xuICAgICAgfSlcbiAgICAgIC5zdGF0ZSgnd29ya2Zsb3cnLCB7XG4gICAgICAgIHVybDogJy9kaWdlc3RzLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvdGVtcGxhdGVzL2RpZ2VzdHMvd29ya2Zsb3cuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdEaWdlc3RXb3JrZmxvd0N0cmwnXG4gICAgICB9KTtcblxuICAgIC8vIGlmIG5vbmUgb2YgdGhlIGFib3ZlIHN0YXRlcyBhcmUgbWF0Y2hlZCwgdXNlIHRoaXMgYXMgdGhlIGZhbGxiYWNrXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnL2hvbWUnKTtcbiAgfSlcbiAgLmNvbmZpZyhmdW5jdGlvbigkbWRUaGVtaW5nUHJvdmlkZXIsICRtZEljb25Qcm92aWRlcikge1xuICAgICRtZFRoZW1pbmdQcm92aWRlci50aGVtZSgnZGVmYXVsdCcpO1xuXG4gICAgJG1kSWNvblByb3ZpZGVyXG4gICAgICAuZGVmYXVsdEljb25TZXQoJy9ib3dlcl9jb21wb25lbnRzL2FuZ3VsYXItbWF0ZXJpYWwvZGVtb3MvaWNvbi9kZW1vU3ZnSWNvblNldHMvYXNzZXRzL2NvcmUtaWNvbnMuc3ZnJywgMjQpO1xuXG4gIH0pXG5cbiAgLnJ1bihmdW5jdGlvbigpIHtcbiAgICBhbmd1bGFyLnNwcmludGYgPSBhbmd1bGFyLnNwcmludGYgfHwgd2luZG93LnNwcmludGYgfHwgZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH07XG4gIH0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ0RpYWxvZ0NvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsICRtZERpYWxvZykge1xuICAndXNlIHN0cmljdCc7XG5cbiAgJHNjb3BlLmNhbmNlbCA9IGZ1bmN0aW9uKCkge1xuICAgICRtZERpYWxvZy5jYW5jZWwoKTtcbiAgfTtcbn0pOyIsImFwcC5jb250cm9sbGVyKCdEaWdlc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkaW5qZWN0b3IpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhclxuICAgIERpZ2VzdFNlcnZpY2UgPSAkaW5qZWN0b3IuZ2V0KCdEaWdlc3RTZXJ2aWNlJyksXG4gICAgRGlnZXN0TW9kZWwgPSAkaW5qZWN0b3IuZ2V0KCdEaWdlc3QnKSxcbiAgICAkbWREaWFsb2cgPSAkaW5qZWN0b3IuZ2V0KCckbWREaWFsb2cnKSxcbiAgICAkbWRUb2FzdCA9ICRpbmplY3Rvci5nZXQoJyRtZFRvYXN0Jyk7XG5cbiAgJHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKCkge1xuICAgICRzY29wZS5kZWZlcnJlZCA9IERpZ2VzdFNlcnZpY2UuZmV0Y2goKVxuICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgJHNjb3BlLmRpZ2VzdHMgPSByZXNwb25zZS5kaWdlc3RzO1xuICAgICAgICAkc2NvcGUudG90YWwgPSByZXNwb25zZS50b3RhbDtcblxuICAgICAgICBpZighJHNjb3BlLmRpZ2VzdHMubGVuZ3RoKXtcbiAgICAgICAgICAkc2NvcGUuYWRkKGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfTtcblxuICAkc2NvcGUuYWRkID0gZnVuY3Rpb24oKXtcbiAgICBEaWdlc3RTZXJ2aWNlLmFkZC5hcHBseShEaWdlc3RTZXJ2aWNlLCBhcmd1bWVudHMpXG4gICAgICAudGhlbihmdW5jdGlvbigpe1xuICAgICAgICAkc2NvcGUuc2VhcmNoKCk7XG4gICAgICAgICRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKCkuY29udGVudCgnRGlnZXN0IHNhdmVkJykpO1xuICAgICAgfSk7XG4gIH07XG5cbiAgJHNjb3BlLnRyaWdnZXIgPSBmdW5jdGlvbih0eXBlLCBpbmRleCwgZXYpe1xuICAgIHZhciBkaWdlc3QgPSBhbmd1bGFyLmNvcHkoJHNjb3BlLmRpZ2VzdHNbaW5kZXhdKTtcbiAgICBzd2l0Y2godHlwZSl7XG4gICAgICBjYXNlICdzYXZlJzpcbiAgICAgICAgRGlnZXN0TW9kZWxcbiAgICAgICAgICAudXBzZXJ0KGRpZ2VzdCwgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKCkuY29udGVudCgnRGlnZXN0IHVwZGF0ZWQnKSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ2RlbGV0ZSc6XG4gICAgICAgIERpZ2VzdFNlcnZpY2UucmVtb3ZlKGV2LCBkaWdlc3QpXG4gICAgICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICRzY29wZS5kaWdlc3RzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICAkbWRUb2FzdC5zaG93KCRtZFRvYXN0LnNpbXBsZSgpLmNvbnRlbnQoJ0RpZ2VzdCBkZWxldGVkJykpO1xuICAgICAgICAgIH0pXG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfTtcblxuICAkc2NvcGUuc2VhcmNoKCk7XG59KTsiLCJhcHAuY29udHJvbGxlcignRGlnZXN0V29ya2Zsb3dDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkaW5qZWN0b3IsICRzdGF0ZSkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyXG4gICAgJG1kVG9hc3QgPSAkaW5qZWN0b3IuZ2V0KCckbWRUb2FzdCcpLFxuICAgIGhlbHBlclNlcnZpY2UgPSAkaW5qZWN0b3IuZ2V0KCdoZWxwZXInKSxcbiAgICBEaWdlc3RNb2RlbCA9ICRpbmplY3Rvci5nZXQoJ0RpZ2VzdCcpLFxuICAgIERpZ2VzdFNlcnZpY2UgPSAkaW5qZWN0b3IuZ2V0KCdEaWdlc3RTZXJ2aWNlJyksXG4gICAgUG9zdFNlcnZpY2UgPSAkaW5qZWN0b3IuZ2V0KCdQb3N0U2VydmljZScpO1xuXG4gIERpZ2VzdFNlcnZpY2UuZmluZCgkc3RhdGUucGFyYW1zLmlkKVxuICAgIC50aGVuKGZ1bmN0aW9uKGRpZ2VzdCkge1xuICAgICAgJHNjb3BlLmRpZ2VzdCA9IGRpZ2VzdDtcbiAgICAgICRzY29wZS5maW5kUG9zdHMoZGlnZXN0LnBvc3RzKTtcblxuICAgICAgJHNjb3BlLiR3YXRjaCgnZGlnZXN0JywgZnVuY3Rpb24obiwgbyl7XG4gICAgICAgIGlmKG4gPT09IG8peyByZXR1cm4gZmFsc2U7IH1cbiAgICAgICAgRGlnZXN0TW9kZWxcbiAgICAgICAgICAudXBzZXJ0KGRpZ2VzdCwgZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICRtZFRvYXN0LnNob3coJG1kVG9hc3Quc2ltcGxlKCkuY29udGVudCgnRGlnZXN0IHVwZGF0ZWQnKSk7XG4gICAgICAgICAgfSlcbiAgICAgIH0sIHRydWUpO1xuXG4gICAgfSk7XG5cbiAgJHNjb3BlLmxpYnJhcnkgPSBmdW5jdGlvbihldil7XG4gICAgUG9zdFNlcnZpY2UubGlicmFyeShldiwgJHNjb3BlLmRpZ2VzdClcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHNlbGN0ZWRQb3N0cyl7XG5cbiAgICAgICAgYW5ndWxhci5mb3JFYWNoKHNlbGN0ZWRQb3N0cywgZnVuY3Rpb24oaWQpe1xuICAgICAgICAgIGlmKCRzY29wZS5kaWdlc3QucG9zdHMuaW5kZXhPZihpZCkgPT09IC0xKXtcbiAgICAgICAgICAgICRzY29wZS5kaWdlc3QucG9zdHMucHVzaChpZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAkc2NvcGUuZmluZFBvc3RzKCRzY29wZS5kaWdlc3QucG9zdHMpO1xuICAgICAgfSk7XG4gIH07XG5cbiAgdmFyIHdhdGNoZXJGbjtcbiAgJHNjb3BlLmZpbmRQb3N0cyA9IGZ1bmN0aW9uKGlkcyl7XG4gICAgaWYoIWlkcyB8fCAhaWRzLmxlbmd0aCl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgUG9zdFNlcnZpY2UuZmluZEJ5SWRzKGlkcylcbiAgICAgIC50aGVuKGZ1bmN0aW9uKHBvc3RzKXtcbiAgICAgICAgaWYoYW5ndWxhci5pc0Z1bmN0aW9uKHdhdGNoZXJGbikpe1xuICAgICAgICAgIHdhdGNoZXJGbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2h1ZmZsZSB0aGUgcG9zdHMgaW4gdGhlIG9yZGVyXG4gICAgICAgIC8vIHRoZXkgaW4gdGhlIGRpZ2VzdC5wb3N0c1xuICAgICAgICBpZigkc2NvcGUuZGlnZXN0LnBvc3RzLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBzb3J0ZWRQb3N0cyA9IFtdO1xuICAgICAgICAgIGFuZ3VsYXIuZm9yRWFjaChwb3N0cywgZnVuY3Rpb24ocG9zdCkge1xuICAgICAgICAgICAgc29ydGVkUG9zdHNbJHNjb3BlLmRpZ2VzdC5wb3N0cy5pbmRleE9mKHBvc3QuaWQudG9TdHJpbmcoKSldID0gcG9zdDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICAkc2NvcGUucG9zdHMgPSBzb3J0ZWRQb3N0cztcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgJHNjb3BlLnBvc3RzID0gcG9zdHM7XG4gICAgICAgIH1cblxuICAgICAgICB3YXRjaGVyRm4gPSAkc2NvcGUuJHdhdGNoKCdwb3N0cycsIGZ1bmN0aW9uKHBvc3RzLCBvbGQpIHtcbiAgICAgICAgICB2YXIgc29ydGVkUG9zdHMgPSBbXTtcbiAgICAgICAgICBhbmd1bGFyLmZvckVhY2gocG9zdHMsIGZ1bmN0aW9uKHBvc3Qpe1xuICAgICAgICAgICAgc29ydGVkUG9zdHMucHVzaChwb3N0LmlkLnRvU3RyaW5nKCkpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmKGhlbHBlclNlcnZpY2UuaXNBcnJheUVxdWFsKHNvcnRlZFBvc3RzLCAkc2NvcGUuZGlnZXN0LnBvc3RzKSl7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICAgICRzY29wZS5kaWdlc3QucG9zdHMgPSBzb3J0ZWRQb3N0cztcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICB9KTtcbiAgfTtcblxuICAkc2NvcGUucmVtb3ZlUG9zdCA9IGZ1bmN0aW9uKGluZGV4KXtcbiAgICAkc2NvcGUuZGlnZXN0LnBvc3RzLnNwbGljZShpbmRleCwgMSk7XG4gICAgJHNjb3BlLnBvc3RzLnNwbGljZShpbmRleCwgMSk7XG4gIH07XG59KTsiLCJhcHAuY29udHJvbGxlcignSG9tZUN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIHVpR21hcEdvb2dsZU1hcEFwaSwgJGluamVjdG9yKXtcbiAgdmFyICRtZERpYWxvZyA9ICRpbmplY3Rvci5nZXQoJyRtZERpYWxvZycpO1xuICAkc2NvcGUubWFwID0geyBjZW50ZXI6IHsgbGF0aXR1ZGU6IDQ1LCBsb25naXR1ZGU6IC03MyB9LCB6b29tOiA4IH07XG5cbiAgJHNjb3BlLnRyaXAgPSB7XG4gICAgcHJpY2U6IDEwMFxuICB9O1xuXG4gIHVpR21hcEdvb2dsZU1hcEFwaS50aGVuKGZ1bmN0aW9uKG1hcHMpIHtcbiAgICAvL2NvbnNvbGUuaW5mbyhtYXBzKTtcbiAgfSk7XG5cbiAgJHNjb3BlLnN0YXJ0ID0gZnVuY3Rpb24oZXYpe1xuICAgIHJldHVybiAkbWREaWFsb2cuc2hvdyh7XG4gICAgICBjb250cm9sbGVyOiBmdW5jdGlvbigkc2NvcGUsICRtZERpYWxvZywgJGNvbnRyb2xsZXIsIHByaWNlKXtcbiAgICAgICAgJGNvbnRyb2xsZXIoJ0RpYWxvZ0NvbnRyb2xsZXInLCB7XG4gICAgICAgICAgJyRzY29wZSc6ICRzY29wZSxcbiAgICAgICAgICAnJG1kRGlhbG9nJzogJG1kRGlhbG9nXG4gICAgICAgIH0pO1xuICAgICAgICAkc2NvcGUuc2VsZWN0ZWRUYWIgPSAwO1xuICAgICAgICAkc2NvcGUub2ZmZXJzID0gW1xuICAgICAgICAgIHsgcHJpY2U6ICckMjUwJywgY2xhc3NOYW1lOiAncmVkJyB9LFxuICAgICAgICAgIHsgcHJpY2U6ICckMzUwJywgY2xhc3NOYW1lOiAnb3JhbmdlJyAgfSxcbiAgICAgICAgICB7IHByaWNlOiAnJDUwMCcsIGNsYXNzTmFtZTogJ3llbGxvdycgIH0sXG4gICAgICAgICAgeyBwcmljZTogJyQ3NTAnLCBjbGFzc05hbWU6ICdibHVlJyAgfSxcbiAgICAgICAgICB7IHByaWNlOiAnJDEwMDAnLCBjbGFzc05hbWU6ICdyZWQnICB9LFxuICAgICAgICAgIHsgcHJpY2U6ICc+ICQxMDAwJywgY2xhc3NOYW1lOiAnb3JhbmdlJyAgfVxuICAgICAgICBdO1xuXG4gICAgICAgIC8vIHNlbGVjdCBwcmljZVxuICAgICAgICAkc2NvcGUuc2VsZWN0T2ZmZXIgPSBmdW5jdGlvbihvZmZlcil7XG4gICAgICAgICAgJHNjb3BlLnNlbGVjdGVkVGFiID0gMTtcbiAgICAgICAgfTtcblxuXG4gICAgICB9LFxuICAgICAgbG9jYWxzOiB7IHByaWNlOiAkc2NvcGUudHJpcC5wcmljZSB9LFxuICAgICAgdGVtcGxhdGVVcmw6ICdqcy90ZW1wbGF0ZXMvc3RhcnQtbW9kYWwuaHRtbCcsXG4gICAgICBwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcbiAgICAgIHRhcmdldEV2ZW50OiBldlxuICAgIH0pO1xuICB9XG5cbn0pOyIsImFwcC5jb250cm9sbGVyKCd3b3Jrc3BhY2VDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkc3RhdGUpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gICRzY29wZS5tZW51ID0gW1xuICAgIHtcbiAgICAgIHRpdGxlOiAnRGlnZXN0cycsXG4gICAgICBpY29uOiAndmlld19jYXJvdXNlbCcsXG4gICAgICBzdGF0ZTogJ2RpZ2VzdHMnXG4gICAgfSxcbiAgICB7XG4gICAgICB0aXRsZTogJ1Bvc3RzJyxcbiAgICAgIGljb246ICdwbGF5bGlzdF9hZGRkJyxcbiAgICAgIHN0YXRlOiAncG9zdHMnXG4gICAgfVxuICBdXG5cbiAgJHNjb3BlLmxlZnRTaWRlbmF2T3BlbiA9IGZhbHNlO1xuICAkc2NvcGUudG9nZ2xlU2lkZW5hdiA9IGZ1bmN0aW9uKCl7XG4gICAgJHNjb3BlLmxlZnRTaWRlbmF2T3BlbiA9ICEkc2NvcGUubGVmdFNpZGVuYXZPcGVuO1xuICB9XG5cbiAgJHNjb3BlLmNoYW5nZVN0YXRlID0gZnVuY3Rpb24oc3RhdGUpe1xuICAgICRzdGF0ZS5nbyhzdGF0ZSk7XG4gICAgJHNjb3BlLnRvZ2dsZVNpZGVuYXYoKTtcbiAgfVxuXG59KTsiLCJhcHAuZGlyZWN0aXZlKFwicHJpY2VTZWxlY3RvclwiLCBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHtcbiAgICByZXF1aXJlOiBcIm5nTW9kZWxcIixcbiAgICBzY29wZToge1xuICAgICAgcHJpY2U6ICc9bmdNb2RlbCdcbiAgICB9LFxuICAgIHRlbXBsYXRlVXJsOiAnanMvdGVtcGxhdGVzL3ByaWNlLXNlbGVjdG9yLmh0bWwnLFxuICAgIGxpbms6IGZ1bmN0aW9uKCRzY29wZSkge1xuXG4gICAgfVxuICB9O1xufSk7IiwiYXBwLnNlcnZpY2UoJ0RpZ2VzdFNlcnZpY2UnLCBmdW5jdGlvbigkaW5qZWN0b3Ipe1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyXG4gICAgRGlnZXN0TW9kZWwgPSAkaW5qZWN0b3IuZ2V0KCdEaWdlc3QnKSxcbiAgICAkcSA9ICRpbmplY3Rvci5nZXQoJyRxJyksXG4gICAgJG1kRGlhbG9nID0gJGluamVjdG9yLmdldCgnJG1kRGlhbG9nJyksXG4gICAgJG1kVG9hc3QgPSAkaW5qZWN0b3IuZ2V0KCckbWRUb2FzdCcpLFxuICAgIHF1ZXJ5ID0ge1xuICAgICAgZmlsdGVyOiB7XG4gICAgICAgIG9yZGVyOiAncHVibGlzaGVkX2RhdGUgREVTQydcbiAgICAgIH1cbiAgICB9O1xuXG4gIC8vIGluIHRoZSBmdXR1cmUgd2UgbWF5IHNlZSBhIGZldyBidWlsdCBpbiBhbHRlcm5hdGUgaGVhZGVycyBidXQgaW4gdGhlIG1lYW4gdGltZVxuICAvLyB5b3UgY2FuIGltcGxlbWVudCB5b3VyIG93biBzZWFyY2ggaGVhZGVyIGFuZCBkbyBzb21ldGhpbmcgbGlrZVxuICB0aGlzLmZldGNoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcbiAgICBEaWdlc3RNb2RlbC5jb3VudChmYWxzZSwgZnVuY3Rpb24oZSl7XG5cbiAgICAgIERpZ2VzdE1vZGVsLmZpbmQocXVlcnksIGZ1bmN0aW9uKGRpZ2VzdHMpe1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICBkaWdlc3RzOiBhbmd1bGFyLmNvcHkoZGlnZXN0cyksXG4gICAgICAgICAgdG90YWw6IGUuY291bnRcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICB9O1xuXG4gIHRoaXMuYWRkID0gZnVuY3Rpb24oZXYsIGRpZ2VzdCl7XG4gICAgZGlnZXN0ID0gZGlnZXN0IHx8IHtcbiAgICAgIGltYWdlOiAnJ1xuICAgIH07XG5cbiAgICByZXR1cm4gJG1kRGlhbG9nLnNob3coe1xuICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24oJHNjb3BlLCAkbWREaWFsb2csICRjb250cm9sbGVyKXtcbiAgICAgICAgJGNvbnRyb2xsZXIoJ0RpYWxvZ0NvbnRyb2xsZXInLCB7XG4gICAgICAgICAgJyRzY29wZSc6ICRzY29wZSxcbiAgICAgICAgICAnJG1kRGlhbG9nJzogJG1kRGlhbG9nXG4gICAgICAgIH0pO1xuXG4gICAgICAgICRzY29wZS5kaWdlc3QgPSBhbmd1bGFyLmNvcHkoZGlnZXN0KTtcblxuICAgICAgICAvLyBvbiAnT0snIGJ0biBjbGlja1xuICAgICAgICAkc2NvcGUub2sgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBEaWdlc3RNb2RlbC51cHNlcnQoJHNjb3BlLmRpZ2VzdCwgJG1kRGlhbG9nLmhpZGUsIGZ1bmN0aW9uKGVycil7XG4gICAgICAgICAgICBjb25zb2xlLmluZm8oZXJyKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgICB0ZW1wbGF0ZVVybDogJ2pzL3RlbXBsYXRlcy9kaWdlc3RzL2FkZC1tb2RhbC5odG1sJyxcbiAgICAgIHBhcmVudDogYW5ndWxhci5lbGVtZW50KGRvY3VtZW50LmJvZHkpLFxuICAgICAgdGFyZ2V0RXZlbnQ6IGV2XG4gICAgfSk7XG4gIH07XG5cbiAgdGhpcy5yZW1vdmUgPSBmdW5jdGlvbihldiwgZGlnZXN0KSB7XG4gICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcbiAgICAkbWREaWFsb2cuc2hvdyhcbiAgICAgICRtZERpYWxvZy5jb25maXJtKClcbiAgICAgICAgLnRpdGxlKCdDb25maXJtIScpXG4gICAgICAgIC5jb250ZW50KCdBcmUgeW91IHN1cmUgd2FudCB0byBkZWxldGUgdGhlIHNlbGVjdGVkIERpZ2VzdD8nKVxuICAgICAgICAub2soJ0NvbmZpcm0nKVxuICAgICAgICAuY2FuY2VsKCdDYW5jZWwnKVxuICAgICAgICAudGFyZ2V0RXZlbnQoZXYpKVxuICAgICAgLnRoZW4oZnVuY3Rpb24oKXtcbiAgICAgICAgRGlnZXN0TW9kZWxcbiAgICAgICAgICAuZGVsZXRlQnlJZCh7aWQ6IGRpZ2VzdC5pZH0sIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICB9O1xuXG4gIHRoaXMuZmluZCA9IGZ1bmN0aW9uKGlkKXtcbiAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgRGlnZXN0TW9kZWwuZmluZCh7XG4gICAgICBmaWx0ZXI6IHtcbiAgICAgICAgd2hlcmU6IHtcbiAgICAgICAgICBpZDogaWRcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uKGRpZ2VzdHMpe1xuICAgICAgZGlnZXN0cyA9IGFuZ3VsYXIuY29weShkaWdlc3RzKTtcbiAgICAgIGRpZ2VzdHMgPSAoZGlnZXN0cy5sZW5ndGgpPyBkaWdlc3RzWzBdIDoge307XG4gICAgICBkZWZlcnJlZC5yZXNvbHZlKGRpZ2VzdHMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn0pO1xuIiwiYXBwLnNlcnZpY2UoJ2hlbHBlcicsIGZ1bmN0aW9uICgkZmlsdGVyKSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgdmFyIGV4cG9ydHMgPSB7fTtcblxuICBleHBvcnRzLmlzRGlzcGxheSA9IGZ1bmN0aW9uKHR5cGUpe1xuICAgIHJldHVybiAodHlwZSA9PT0gJ2Rpc3BsYXknKTtcbiAgfTtcblxuICBleHBvcnRzLnJlbmRlckRhdGVDb2x1bW4gPSBmdW5jdGlvbiAoZGF0YSwgdHlwZSkge1xuICAgIHJldHVybiBleHBvcnRzLmlzRGlzcGxheSh0eXBlKT8gJGZpbHRlcignZGF0ZScsICdzaG9ydCcpKGRhdGEpIDogJyc7XG4gIH07XG5cbiAgZXhwb3J0cy5yZW5kZXJMaW5rQ29sdW1uID0gZnVuY3Rpb24gKGRhdGEsIHR5cGUsIGZ1bGwpIHtcbiAgICBpZihleHBvcnRzLmlzRGlzcGxheSh0eXBlKSl7XG4gICAgICByZXR1cm4gYW5ndWxhci5zcHJpbnRmKCc8YSBocmVmPVwiIy9wb3N0cy8lKGlkKXNcIiBkYXRhLWlkPVwiJShpZClzXCI+JSh0aXRsZSlzPC9hPicsIHtcbiAgICAgICAgaWQ6IGZ1bGwuaWQsXG4gICAgICAgIHRpdGxlOiBmdWxsLnRpdGxlXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuICcnO1xuICB9O1xuXG4gIGV4cG9ydHMuaXNBcnJheUVxdWFsID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBfLmFsbChfLnppcChhLCBiKSwgZnVuY3Rpb24oeCkge1xuICAgICAgcmV0dXJuIHhbMF0gPT09IHhbMV07XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIGV4cG9ydHM7XG59KTtcbiIsIihmdW5jdGlvbih3aW5kb3csIGFuZ3VsYXIsIHVuZGVmaW5lZCkgeyd1c2Ugc3RyaWN0JztcblxudmFyIHVybEJhc2UgPSBcIi9hcGlcIjtcbnZhciBhdXRoSGVhZGVyID0gJ2F1dGhvcml6YXRpb24nO1xuXG4vKipcbiAqIEBuZ2RvYyBvdmVydmlld1xuICogQG5hbWUgbGJTZXJ2aWNlc1xuICogQG1vZHVsZVxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogVGhlIGBsYlNlcnZpY2VzYCBtb2R1bGUgcHJvdmlkZXMgc2VydmljZXMgZm9yIGludGVyYWN0aW5nIHdpdGhcbiAqIHRoZSBtb2RlbHMgZXhwb3NlZCBieSB0aGUgTG9vcEJhY2sgc2VydmVyIHZpYSB0aGUgUkVTVCBBUEkuXG4gKlxuICovXG52YXIgbW9kdWxlID0gYW5ndWxhci5tb2R1bGUoXCJsYlNlcnZpY2VzXCIsIFsnbmdSZXNvdXJjZSddKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJcbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Vc2VyXG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgVXNlcmAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJVc2VyXCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi91c2Vycy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmZpbmRCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19maW5kQnlJZF9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuZGVzdHJveUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2Rlc3Ryb3lCeUlkX19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy51cGRhdGVCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX191cGRhdGVCeUlkX19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmZpbmRCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19maW5kQnlJZF9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuZGVzdHJveUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2Rlc3Ryb3lCeUlkX19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy51cGRhdGVCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX191cGRhdGVCeUlkX19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmZpbmRCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19maW5kQnlJZF9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuZGVzdHJveUJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2Rlc3Ryb3lCeUlkX19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy51cGRhdGVCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX191cGRhdGVCeUlkX19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19nZXRfX2FjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5jcmVhdGUoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2NyZWF0ZV9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMuZGVzdHJveUFsbCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZGVsZXRlX19hY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmNvdW50KCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19jb3VudF9fYWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19nZXRfX2NyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5jcmVhdGUoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2NyZWF0ZV9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMuZGVzdHJveUFsbCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZGVsZXRlX19jcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmNvdW50KCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19jb3VudF9fY3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19nZXRfX2lkZW50aXRpZXNcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy5jcmVhdGUoKSBpbnN0ZWFkLlxuICAgICAgICBcInByb3RvdHlwZSRfX2NyZWF0ZV9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuZGVzdHJveUFsbCgpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZGVsZXRlX19pZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmNvdW50KCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19jb3VudF9faWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2lkZW50aXRpZXMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vyc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjbG9naW5cbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogTG9naW4gYSB1c2VyIHdpdGggdXNlcm5hbWUvZW1haWwgYW5kIHBhc3N3b3JkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaW5jbHVkZWAg4oCTIGB7c3RyaW5nPX1gIC0gUmVsYXRlZCBvYmplY3RzIHRvIGluY2x1ZGUgaW4gdGhlIHJlc3BvbnNlLiBTZWUgdGhlIGRlc2NyaXB0aW9uIG9mIHJldHVybiB2YWx1ZSBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAgICAgKiAgIERlZmF1bHQgdmFsdWU6IGB1c2VyYC5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHJlbWVtYmVyTWVgIC0gYGJvb2xlYW5gIC0gV2hldGhlciB0aGUgYXV0aGVudGljYXRpb24gY3JlZGVudGlhbHNcbiAgICAgICAgICogICAgIHNob3VsZCBiZSByZW1lbWJlcmVkIGluIGxvY2FsU3RvcmFnZSBhY3Jvc3MgYXBwL2Jyb3dzZXIgcmVzdGFydHMuXG4gICAgICAgICAqICAgICBEZWZhdWx0OiBgdHJ1ZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoZSByZXNwb25zZSBib2R5IGNvbnRhaW5zIHByb3BlcnRpZXMgb2YgdGhlIEFjY2Vzc1Rva2VuIGNyZWF0ZWQgb24gbG9naW4uXG4gICAgICAgICAqIERlcGVuZGluZyBvbiB0aGUgdmFsdWUgb2YgYGluY2x1ZGVgIHBhcmFtZXRlciwgdGhlIGJvZHkgbWF5IGNvbnRhaW4gYWRkaXRpb25hbCBwcm9wZXJ0aWVzOlxuICAgICAgICAgKiBcbiAgICAgICAgICogICAtIGB1c2VyYCAtIGB7VXNlcn1gIC0gRGF0YSBvZiB0aGUgY3VycmVudGx5IGxvZ2dlZCBpbiB1c2VyLiAoYGluY2x1ZGU9dXNlcmApXG4gICAgICAgICAqIFxuICAgICAgICAgKlxuICAgICAgICAgKi9cbiAgICAgICAgXCJsb2dpblwiOiB7XG4gICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICBpbmNsdWRlOiBcInVzZXJcIlxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW50ZXJjZXB0b3I6IHtcbiAgICAgICAgICAgIHJlc3BvbnNlOiBmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICB2YXIgYWNjZXNzVG9rZW4gPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICBMb29wQmFja0F1dGguc2V0VXNlcihhY2Nlc3NUb2tlbi5pZCwgYWNjZXNzVG9rZW4udXNlcklkLCBhY2Nlc3NUb2tlbi51c2VyKTtcbiAgICAgICAgICAgICAgTG9vcEJhY2tBdXRoLnJlbWVtYmVyTWUgPSByZXNwb25zZS5jb25maWcucGFyYW1zLnJlbWVtYmVyTWUgIT09IGZhbHNlO1xuICAgICAgICAgICAgICBMb29wQmFja0F1dGguc2F2ZSgpO1xuICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy9sb2dpblwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjbG9nb3V0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIExvZ291dCBhIHVzZXIgd2l0aCBhY2Nlc3MgdG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGFjY2Vzc190b2tlbmAg4oCTIGB7c3RyaW5nfWAgLSBEbyBub3Qgc3VwcGx5IHRoaXMgYXJndW1lbnQsIGl0IGlzIGF1dG9tYXRpY2FsbHkgZXh0cmFjdGVkIGZyb20gcmVxdWVzdCBoZWFkZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImxvZ291dFwiOiB7XG4gICAgICAgICAgaW50ZXJjZXB0b3I6IHtcbiAgICAgICAgICAgIHJlc3BvbnNlOiBmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICBMb29wQmFja0F1dGguY2xlYXJVc2VyKCk7XG4gICAgICAgICAgICAgIExvb3BCYWNrQXV0aC5jbGVhclN0b3JhZ2UoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc291cmNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvbG9nb3V0XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNjb25maXJtXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvbmZpcm0gYSB1c2VyIHJlZ2lzdHJhdGlvbiB3aXRoIGVtYWlsIHZlcmlmaWNhdGlvbiB0b2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgdWlkYCDigJMgYHtzdHJpbmd9YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgdG9rZW5gIOKAkyBge3N0cmluZ31gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGByZWRpcmVjdGAg4oCTIGB7c3RyaW5nPX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiY29uZmlybVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvY29uZmlybVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNyZXNldFBhc3N3b3JkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFJlc2V0IHBhc3N3b3JkIGZvciBhIHVzZXIgd2l0aCBlbWFpbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInJlc2V0UGFzc3dvcmRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzL3Jlc2V0XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgQWNjZXNzVG9rZW4udXNlcigpIGluc3RlYWQuXG4gICAgICAgIFwiOjpnZXQ6OmFjY2Vzc1Rva2VuOjp1c2VyXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkL3VzZXJcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXJDcmVkZW50aWFsLnVzZXIoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Z2V0Ojp1c2VyQ3JlZGVudGlhbDo6dXNlclwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZC91c2VyXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VySWRlbnRpdHkudXNlcigpIGluc3RlYWQuXG4gICAgICAgIFwiOjpnZXQ6OnVzZXJJZGVudGl0eTo6dXNlclwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkL3VzZXJcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjZ2V0Q3VycmVudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBHZXQgZGF0YSBvZiB0aGUgY3VycmVudGx5IGxvZ2dlZCB1c2VyLiBGYWlsIHdpdGggSFRUUCByZXN1bHQgNDAxXG4gICAgICAgICAqIHdoZW4gdGhlcmUgaXMgbm8gdXNlciBsb2dnZWQgaW4uXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICovXG4gICAgICAgIFwiZ2V0Q3VycmVudFwiOiB7XG4gICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzXCIgKyBcIi86aWRcIixcbiAgICAgICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICBpZDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIHZhciBpZCA9IExvb3BCYWNrQXV0aC5jdXJyZW50VXNlcklkO1xuICAgICAgICAgICAgICBpZiAoaWQgPT0gbnVsbCkgaWQgPSAnX19hbm9ueW1vdXNfXyc7XG4gICAgICAgICAgICAgIHJldHVybiBpZDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbnRlcmNlcHRvcjoge1xuICAgICAgICAgICAgcmVzcG9uc2U6IGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgIExvb3BCYWNrQXV0aC5jdXJyZW50VXNlckRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBfX2lzR2V0Q3VycmVudFVzZXJfXyA6IHRydWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVcIl0gPSBSW1widXBkYXRlQWxsXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjcmVtb3ZlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNnZXRDYWNoZWRDdXJyZW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEdldCBkYXRhIG9mIHRoZSBjdXJyZW50bHkgbG9nZ2VkIHVzZXIgdGhhdCB3YXMgcmV0dXJuZWQgYnkgdGhlIGxhc3RcbiAgICAgICAgICogY2FsbCB0byB7QGxpbmsgbGJTZXJ2aWNlcy5Vc2VyI2xvZ2lufSBvclxuICAgICAgICAgKiB7QGxpbmsgbGJTZXJ2aWNlcy5Vc2VyI2dldEN1cnJlbnR9LiBSZXR1cm4gbnVsbCB3aGVuIHRoZXJlXG4gICAgICAgICAqIGlzIG5vIHVzZXIgbG9nZ2VkIGluIG9yIHRoZSBkYXRhIG9mIHRoZSBjdXJyZW50IHVzZXIgd2VyZSBub3QgZmV0Y2hlZFxuICAgICAgICAgKiB5ZXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEEgVXNlciBpbnN0YW5jZS5cbiAgICAgICAgICovXG4gICAgICAgIFIuZ2V0Q2FjaGVkQ3VycmVudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBkYXRhID0gTG9vcEJhY2tBdXRoLmN1cnJlbnRVc2VyRGF0YTtcbiAgICAgICAgICByZXR1cm4gZGF0YSA/IG5ldyBSKGRhdGEpIDogbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjaXNBdXRoZW50aWNhdGVkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGN1cnJlbnQgdXNlciBpcyBhdXRoZW50aWNhdGVkIChsb2dnZWQgaW4pLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRDdXJyZW50SWQoKSAhPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNnZXRDdXJyZW50SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBJZCBvZiB0aGUgY3VycmVudGx5IGxvZ2dlZC1pbiB1c2VyIG9yIG51bGwuXG4gICAgICAgICAqL1xuICAgICAgICBSLmdldEN1cnJlbnRJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBMb29wQmFja0F1dGguY3VycmVudFVzZXJJZDtcbiAgICAgICAgfTtcblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIjbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLlVzZXJcbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgVXNlcmAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiVXNlclwiO1xuXG4gICAgLyoqXG4gICAgICogQG5nZG9jIG9iamVjdFxuICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgKiBAaGVhZGVyIGxiU2VydmljZXMuVXNlci5hY2Nlc3NUb2tlbnNcbiAgICAgKiBAb2JqZWN0XG4gICAgICogQGRlc2NyaXB0aW9uXG4gICAgICpcbiAgICAgKiBUaGUgb2JqZWN0IGBVc2VyLmFjY2Vzc1Rva2Vuc2AgZ3JvdXBzIG1ldGhvZHNcbiAgICAgKiBtYW5pcHVsYXRpbmcgYEFjY2Vzc1Rva2VuYCBpbnN0YW5jZXMgcmVsYXRlZCB0byBgVXNlcmAuXG4gICAgICpcbiAgICAgKiBDYWxsIHtAbGluayBsYlNlcnZpY2VzLlVzZXIjYWNjZXNzVG9rZW5zIFVzZXIuYWNjZXNzVG9rZW5zKCl9XG4gICAgICogdG8gcXVlcnkgYWxsIHJlbGF0ZWQgaW5zdGFuY2VzLlxuICAgICAqL1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2FjY2Vzc1Rva2Vuc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBRdWVyaWVzIGFjY2Vzc1Rva2VucyBvZiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpnZXQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2VucyNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnRzIGFjY2Vzc1Rva2VucyBvZiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMuY291bnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpjb3VudDo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBpbiBhY2Nlc3NUb2tlbnMgb2YgdGhpcyBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmFjY2Vzc1Rva2Vucy5jcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpjcmVhdGU6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2VucyNkZXN0cm95QWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGVzIGFsbCBhY2Nlc3NUb2tlbnMgb2YgdGhpcyBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zLmRlc3Ryb3lBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpkZWxldGU6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2VucyNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBhY2Nlc3NUb2tlbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBhY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMuZGVzdHJveUJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiQWNjZXNzVG9rZW5cIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpkZXN0cm95QnlJZDo6dXNlcjo6YWNjZXNzVG9rZW5zXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBhY2Nlc3NUb2tlbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBhY2Nlc3NUb2tlbnNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIuYWNjZXNzVG9rZW5zLmZpbmRCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIkFjY2Vzc1Rva2VuXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZmluZEJ5SWQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmFjY2Vzc1Rva2VucyN1cGRhdGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuYWNjZXNzVG9rZW5zXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGFjY2Vzc1Rva2Vucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGFjY2Vzc1Rva2Vuc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5hY2Nlc3NUb2tlbnMudXBkYXRlQnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJBY2Nlc3NUb2tlblwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OnVwZGF0ZUJ5SWQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgLyoqXG4gICAgICogQG5nZG9jIG9iamVjdFxuICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICogQG9iamVjdFxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqXG4gICAgICogVGhlIG9iamVjdCBgVXNlci5jcmVkZW50aWFsc2AgZ3JvdXBzIG1ldGhvZHNcbiAgICAgKiBtYW5pcHVsYXRpbmcgYFVzZXJDcmVkZW50aWFsYCBpbnN0YW5jZXMgcmVsYXRlZCB0byBgVXNlcmAuXG4gICAgICpcbiAgICAgKiBDYWxsIHtAbGluayBsYlNlcnZpY2VzLlVzZXIjY3JlZGVudGlhbHMgVXNlci5jcmVkZW50aWFscygpfVxuICAgICAqIHRvIHF1ZXJ5IGFsbCByZWxhdGVkIGluc3RhbmNlcy5cbiAgICAgKi9cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlciNjcmVkZW50aWFsc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBRdWVyaWVzIGNyZWRlbnRpYWxzIG9mIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Z2V0Ojp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50cyBjcmVkZW50aWFscyBvZiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscy5jb3VudCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmNvdW50Ojp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIGluIGNyZWRlbnRpYWxzIG9mIHRoaXMgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscy5jcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpjcmVhdGU6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHMjZGVzdHJveUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGVzIGFsbCBjcmVkZW50aWFscyBvZiB0aGlzIG1vZGVsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscy5kZXN0cm95QWxsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZGVsZXRlOjp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHNcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgY3JlZGVudGlhbHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBjcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzLmRlc3Ryb3lCeUlkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJDcmVkZW50aWFsXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZGVzdHJveUJ5SWQ6OnVzZXI6OmNyZWRlbnRpYWxzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuY3JlZGVudGlhbHMjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgY3JlZGVudGlhbHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBjcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5jcmVkZW50aWFscy5maW5kQnlJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyQ3JlZGVudGlhbFwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmZpbmRCeUlkOjp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmNyZWRlbnRpYWxzI3VwZGF0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5jcmVkZW50aWFsc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBjcmVkZW50aWFscy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGNyZWRlbnRpYWxzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmNyZWRlbnRpYWxzLnVwZGF0ZUJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlckNyZWRlbnRpYWxcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjp1cGRhdGVCeUlkOjp1c2VyOjpjcmVkZW50aWFsc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG4gICAgLyoqXG4gICAgICogQG5nZG9jIG9iamVjdFxuICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICogQGhlYWRlciBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAqIEBvYmplY3RcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKlxuICAgICAqIFRoZSBvYmplY3QgYFVzZXIuaWRlbnRpdGllc2AgZ3JvdXBzIG1ldGhvZHNcbiAgICAgKiBtYW5pcHVsYXRpbmcgYFVzZXJJZGVudGl0eWAgaW5zdGFuY2VzIHJlbGF0ZWQgdG8gYFVzZXJgLlxuICAgICAqXG4gICAgICogQ2FsbCB7QGxpbmsgbGJTZXJ2aWNlcy5Vc2VyI2lkZW50aXRpZXMgVXNlci5pZGVudGl0aWVzKCl9XG4gICAgICogdG8gcXVlcnkgYWxsIHJlbGF0ZWQgaW5zdGFuY2VzLlxuICAgICAqL1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyI2lkZW50aXRpZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlclxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogUXVlcmllcyBpZGVudGl0aWVzIG9mIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmdldDo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyLmlkZW50aXRpZXMjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudHMgaWRlbnRpdGllcyBvZiB1c2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzLmNvdW50ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJJZGVudGl0eVwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmNvdW50Ojp1c2VyOjppZGVudGl0aWVzXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllcyNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIGluIGlkZW50aXRpZXMgb2YgdGhpcyBtb2RlbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzLmNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpjcmVhdGU6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzI2Rlc3Ryb3lBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGVzIGFsbCBpZGVudGl0aWVzIG9mIHRoaXMgbW9kZWwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMuZGVzdHJveUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VySWRlbnRpdHlcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpkZWxldGU6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgcmVsYXRlZCBpdGVtIGJ5IGlkIGZvciBpZGVudGl0aWVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXIgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZrYCDigJMgYHsqfWAgLSBGb3JlaWduIGtleSBmb3IgaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMuZGVzdHJveUJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZGVzdHJveUJ5SWQ6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXIuaWRlbnRpdGllc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIHJlbGF0ZWQgaXRlbSBieSBpZCBmb3IgaWRlbnRpdGllcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBVc2VyIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBma2Ag4oCTIGB7Kn1gIC0gRm9yZWlnbiBrZXkgZm9yIGlkZW50aXRpZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLmlkZW50aXRpZXMuZmluZEJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6ZmluZEJ5SWQ6OnVzZXI6OmlkZW50aXRpZXNcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzI3VwZGF0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlci5pZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYSByZWxhdGVkIGl0ZW0gYnkgaWQgZm9yIGlkZW50aXRpZXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlciBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmtgIOKAkyBgeyp9YCAtIEZvcmVpZ24ga2V5IGZvciBpZGVudGl0aWVzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi5pZGVudGl0aWVzLnVwZGF0ZUJ5SWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlcklkZW50aXR5XCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6dXBkYXRlQnlJZDo6dXNlcjo6aWRlbnRpdGllc1wiXTtcbiAgICAgICAgICByZXR1cm4gYWN0aW9uLmFwcGx5KFIsIGFyZ3VtZW50cyk7XG4gICAgICAgIH07XG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYEFjY2Vzc1Rva2VuYCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIkFjY2Vzc1Rva2VuXCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBBY2Nlc3NUb2tlbi51c2VyKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19nZXRfX3VzZXJcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWQvdXNlclwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vuc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3Vwc2VydFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWQvZXhpc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZEJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYWxsIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihBcnJheS48T2JqZWN0PixPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXkuPE9iamVjdD59IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEFjY2Vzc1Rva2VuYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9hY2Nlc3NUb2tlbnMvZmluZE9uZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zL3VwZGF0ZVwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvYWNjZXNzVG9rZW5zL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gQWNjZXNzVG9rZW4gaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBBY2Nlc3NUb2tlbmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwicHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2FjY2Vzc1Rva2Vucy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuYWNjZXNzVG9rZW5zLmZpbmRCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmZpbmRCeUlkOjp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5kZXN0cm95QnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpkZXN0cm95QnlJZDo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5hY2Nlc3NUb2tlbnMudXBkYXRlQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjp1cGRhdGVCeUlkOjp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnMvOmZrXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2VucygpIGluc3RlYWQuXG4gICAgICAgIFwiOjpnZXQ6OnVzZXI6OmFjY2Vzc1Rva2Vuc1wiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5jcmVhdGUoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Y3JlYXRlOjp1c2VyOjphY2Nlc3NUb2tlbnNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9hY2Nlc3NUb2tlbnNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5kZXN0cm95QWxsKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmRlbGV0ZTo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmFjY2Vzc1Rva2Vucy5jb3VudCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpjb3VudDo6dXNlcjo6YWNjZXNzVG9rZW5zXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvYWNjZXNzVG9rZW5zL2NvdW50XCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlbiN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgQWNjZXNzVG9rZW5gIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuQWNjZXNzVG9rZW5cbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLkFjY2Vzc1Rva2VuI21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBBY2Nlc3NUb2tlbmAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiQWNjZXNzVG9rZW5cIjtcblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuQWNjZXNzVG9rZW4jdXNlclxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5BY2Nlc3NUb2tlblxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmV0Y2hlcyBiZWxvbmdzVG8gcmVsYXRpb24gdXNlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBBY2Nlc3NUb2tlbiBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgcmVmcmVzaGAg4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSLnVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgVGFyZ2V0UmVzb3VyY2UgPSAkaW5qZWN0b3IuZ2V0KFwiVXNlclwiKTtcbiAgICAgICAgICB2YXIgYWN0aW9uID0gVGFyZ2V0UmVzb3VyY2VbXCI6OmdldDo6YWNjZXNzVG9rZW46OnVzZXJcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gKiBAaGVhZGVyIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBVc2VyQ3JlZGVudGlhbGAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJVc2VyQ3JlZGVudGlhbFwiLFxuICBbJ0xvb3BCYWNrUmVzb3VyY2UnLCAnTG9vcEJhY2tBdXRoJywgJyRpbmplY3RvcicsIGZ1bmN0aW9uKFJlc291cmNlLCBMb29wQmFja0F1dGgsICRpbmplY3Rvcikge1xuICAgIHZhciBSID0gUmVzb3VyY2UoXG4gICAgICB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlckNyZWRlbnRpYWwudXNlcigpIGluc3RlYWQuXG4gICAgICAgIFwicHJvdG90eXBlJF9fZ2V0X191c2VyXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkL3VzZXJcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCN1cHNlcnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGFsbCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oQXJyYXkuPE9iamVjdD4sT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge0FycmF5LjxPYmplY3Q+fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjZmluZE9uZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyQ3JlZGVudGlhbGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlckNyZWRlbnRpYWxzL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy91cGRhdGVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJDcmVkZW50aWFscy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFVzZXJDcmVkZW50aWFsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlckNyZWRlbnRpYWxgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInByb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VyQ3JlZGVudGlhbHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmNyZWRlbnRpYWxzLmZpbmRCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmZpbmRCeUlkOjp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5kZXN0cm95QnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpkZXN0cm95QnlJZDo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuY3JlZGVudGlhbHMudXBkYXRlQnlJZCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjp1cGRhdGVCeUlkOjp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscygpIGluc3RlYWQuXG4gICAgICAgIFwiOjpnZXQ6OnVzZXI6OmNyZWRlbnRpYWxzXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5jcmVhdGUoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6Y3JlYXRlOjp1c2VyOjpjcmVkZW50aWFsc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcnMvOmlkL2NyZWRlbnRpYWxzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5kZXN0cm95QWxsKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmRlbGV0ZTo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFsc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5jcmVkZW50aWFscy5jb3VudCgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpjb3VudDo6dXNlcjo6Y3JlZGVudGlhbHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9jcmVkZW50aWFscy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWwjdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFVzZXJDcmVkZW50aWFsYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VyQ3JlZGVudGlhbCNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgVXNlckNyZWRlbnRpYWxgLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIlVzZXJDcmVkZW50aWFsXCI7XG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJDcmVkZW50aWFsI3VzZXJcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlckNyZWRlbnRpYWxcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZldGNoZXMgYmVsb25nc1RvIHJlbGF0aW9uIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlckNyZWRlbnRpYWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHJlZnJlc2hgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VyYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUi51c2VyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIFRhcmdldFJlc291cmNlID0gJGluamVjdG9yLmdldChcIlVzZXJcIik7XG4gICAgICAgICAgdmFyIGFjdGlvbiA9IFRhcmdldFJlc291cmNlW1wiOjpnZXQ6OnVzZXJDcmVkZW50aWFsOjp1c2VyXCJdO1xuICAgICAgICAgIHJldHVybiBhY3Rpb24uYXBwbHkoUiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBVc2VySWRlbnRpdHlgIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiVXNlcklkZW50aXR5XCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXJJZGVudGl0eS51c2VyKCkgaW5zdGVhZC5cbiAgICAgICAgXCJwcm90b3R5cGUkX19nZXRfX3VzZXJcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZC91c2VyXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkL2V4aXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNmaW5kT25lXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBVc2VySWRlbnRpdHlgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzL2ZpbmRPbmVcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJJZGVudGl0aWVzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2VySWRlbnRpdGllcy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlcklkZW50aXR5IGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvdXNlcklkZW50aXRpZXMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSU5URVJOQUwuIFVzZSBVc2VyLmlkZW50aXRpZXMuZmluZEJ5SWQoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZmluZEJ5SWQ6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmRlc3Ryb3lCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmRlc3Ryb3lCeUlkOjp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy86ZmtcIixcbiAgICAgICAgICBtZXRob2Q6IFwiREVMRVRFXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJTlRFUk5BTC4gVXNlIFVzZXIuaWRlbnRpdGllcy51cGRhdGVCeUlkKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OnVwZGF0ZUJ5SWQ6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzLzpma1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzKCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmdldDo6dXNlcjo6aWRlbnRpdGllc1wiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmNyZWF0ZSgpIGluc3RlYWQuXG4gICAgICAgIFwiOjpjcmVhdGU6OnVzZXI6OmlkZW50aXRpZXNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3VzZXJzLzppZC9pZGVudGl0aWVzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmRlc3Ryb3lBbGwoKSBpbnN0ZWFkLlxuICAgICAgICBcIjo6ZGVsZXRlOjp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllc1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJERUxFVEVcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIElOVEVSTkFMLiBVc2UgVXNlci5pZGVudGl0aWVzLmNvdW50KCkgaW5zdGVhZC5cbiAgICAgICAgXCI6OmNvdW50Ojp1c2VyOjppZGVudGl0aWVzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi91c2Vycy86aWQvaWRlbnRpdGllcy9jb3VudFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcklkZW50aXR5YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlXCJdID0gUltcInVwZGF0ZUFsbFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eSNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuVXNlcklkZW50aXR5I3JlbW92ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuVXNlcklkZW50aXR5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLlVzZXJJZGVudGl0eVxuICAgICogQGRlc2NyaXB0aW9uXG4gICAgKiBUaGUgbmFtZSBvZiB0aGUgbW9kZWwgcmVwcmVzZW50ZWQgYnkgdGhpcyAkcmVzb3VyY2UsXG4gICAgKiBpLmUuIGBVc2VySWRlbnRpdHlgLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIlVzZXJJZGVudGl0eVwiO1xuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHkjdXNlclxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Vc2VySWRlbnRpdHlcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZldGNoZXMgYmVsb25nc1RvIHJlbGF0aW9uIHVzZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gVXNlcklkZW50aXR5IGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGByZWZyZXNoYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgVXNlcmAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFIudXNlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHZhciBUYXJnZXRSZXNvdXJjZSA9ICRpbmplY3Rvci5nZXQoXCJVc2VyXCIpO1xuICAgICAgICAgIHZhciBhY3Rpb24gPSBUYXJnZXRSZXNvdXJjZVtcIjo6Z2V0Ojp1c2VySWRlbnRpdHk6OnVzZXJcIl07XG4gICAgICAgICAgcmV0dXJuIGFjdGlvbi5hcHBseShSLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuLyoqXG4gKiBAbmdkb2Mgb2JqZWN0XG4gKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3RcbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5Qb3N0XG4gKiBAb2JqZWN0XG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogQSAkcmVzb3VyY2Ugb2JqZWN0IGZvciBpbnRlcmFjdGluZyB3aXRoIHRoZSBgUG9zdGAgbW9kZWwuXG4gKlxuICogIyMgRXhhbXBsZVxuICpcbiAqIFNlZVxuICoge0BsaW5rIGh0dHA6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvYXBpL25nUmVzb3VyY2UuJHJlc291cmNlI2V4YW1wbGUgJHJlc291cmNlfVxuICogZm9yIGFuIGV4YW1wbGUgb2YgdXNpbmcgdGhpcyBvYmplY3QuXG4gKlxuICovXG5tb2R1bGUuZmFjdG9yeShcbiAgXCJQb3N0XCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi9wb3N0cy86aWRcIixcbiAgICAgIHsgJ2lkJzogJ0BpZCcgfSxcbiAgICAgIHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjY3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgUG9zdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiY3JlYXRlXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcInVwc2VydFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjZXhpc3RzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENoZWNrIHdoZXRoZXIgYSBtb2RlbCBpbnN0YW5jZSBleGlzdHMgaW4gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGV4aXN0c2Ag4oCTIGB7Ym9vbGVhbj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJleGlzdHNcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjZmluZEJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMgYW5kIGluY2x1ZGVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2ZpbmRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kXCI6IHtcbiAgICAgICAgICBpc0FycmF5OiB0cnVlLFxuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL3Bvc3RzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBmaXJzdCBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSBmaWx0ZXIgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBmaWx0ZXJgIOKAkyBge29iamVjdD19YCAtIEZpbHRlciBkZWZpbmluZyBmaWVsZHMsIHdoZXJlLCBpbmNsdWRlLCBvcmRlciwgb2Zmc2V0LCBhbmQgbGltaXRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kT25lXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9wb3N0cy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I3VwZGF0ZUFsbFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5Qb3N0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcInVwZGF0ZUFsbFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNkZWxldGVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwiZGVsZXRlQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2NvdW50XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENvdW50IGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgY291bnRgIOKAkyBge251bWJlcj19YCAtIFxuICAgICAgICAgKi9cbiAgICAgICAgXCJjb3VudFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjcHJvdG90eXBlJHVwZGF0ZUF0dHJpYnV0ZXNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGF0dHJpYnV0ZXMgZm9yIGEgbW9kZWwgaW5zdGFuY2UgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gUGVyc2lzdGVkTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBQb3N0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvcG9zdHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBVVFwiXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgKTtcblxuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I3VwZGF0ZU9yQ3JlYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYFBvc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBSW1widXBkYXRlT3JDcmVhdGVcIl0gPSBSW1widXBzZXJ0XCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCN1cGRhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuUG9zdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Qb3N0I2Rlc3Ryb3lCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJkZXN0cm95QnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuUG9zdCNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIERlbGV0ZSBhIG1vZGVsIGluc3RhbmNlIGJ5IGlkIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJyZW1vdmVCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cblxuICAgIC8qKlxuICAgICogQG5nZG9jIHByb3BlcnR5XG4gICAgKiBAbmFtZSBsYlNlcnZpY2VzLlBvc3QjbW9kZWxOYW1lXG4gICAgKiBAcHJvcGVydHlPZiBsYlNlcnZpY2VzLlBvc3RcbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgUG9zdGAuXG4gICAgKi9cbiAgICBSLm1vZGVsTmFtZSA9IFwiUG9zdFwiO1xuXG5cbiAgICByZXR1cm4gUjtcbiAgfV0pO1xuXG4vKipcbiAqIEBuZ2RvYyBvYmplY3RcbiAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2VcbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5JbWFnZVxuICogQG9iamVjdFxuICpcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIEEgJHJlc291cmNlIG9iamVjdCBmb3IgaW50ZXJhY3Rpbmcgd2l0aCB0aGUgYEltYWdlYCBtb2RlbC5cbiAqXG4gKiAjIyBFeGFtcGxlXG4gKlxuICogU2VlXG4gKiB7QGxpbmsgaHR0cDovL2RvY3MuYW5ndWxhcmpzLm9yZy9hcGkvbmdSZXNvdXJjZS4kcmVzb3VyY2UjZXhhbXBsZSAkcmVzb3VyY2V9XG4gKiBmb3IgYW4gZXhhbXBsZSBvZiB1c2luZyB0aGlzIG9iamVjdC5cbiAqXG4gKi9cbm1vZHVsZS5mYWN0b3J5KFxuICBcIkltYWdlXCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi9pbWFnZXMvOmlkXCIsXG4gICAgICB7ICdpZCc6ICdAaWQnIH0sXG4gICAgICB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNjcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImNyZWF0ZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYW4gZXhpc3RpbmcgbW9kZWwgaW5zdGFuY2Ugb3IgaW5zZXJ0IGEgbmV3IG9uZSBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogICBUaGlzIG1ldGhvZCBkb2VzIG5vdCBhY2NlcHQgYW55IHBhcmFtZXRlcnMuXG4gICAgICAgICAqICAgU3VwcGx5IGFuIGVtcHR5IG9iamVjdCBvciBvbWl0IHRoaXMgYXJndW1lbnQgYWx0b2dldGhlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBzZXJ0XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2V4aXN0c1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ2hlY2sgd2hldGhlciBhIG1vZGVsIGluc3RhbmNlIGV4aXN0cyBpbiB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogRGF0YSBwcm9wZXJ0aWVzOlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZXhpc3RzYCDigJMgYHtib29sZWFuPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImV4aXN0c1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2ZpbmRCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcyBhbmQgaW5jbHVkZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjZmluZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBJbWFnZWAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZFwiOiB7XG4gICAgICAgICAgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgZmlyc3QgaW5zdGFuY2Ugb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgZmlsdGVyIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzLCB3aGVyZSwgaW5jbHVkZSwgb3JkZXIsIG9mZnNldCwgYW5kIGxpbWl0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgSW1hZ2VgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRPbmVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2ltYWdlcy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSN1cGRhdGVBbGxcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgbm8gZGF0YS5cbiAgICAgICAgICovXG4gICAgICAgIFwidXBkYXRlQWxsXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjZGVsZXRlQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJkZWxldGVCeUlkXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNjb3VudFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQ291bnQgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IHdoZXJlIGZyb20gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgd2hlcmVgIOKAkyBge29iamVjdD19YCAtIENyaXRlcmlhIHRvIG1hdGNoIG1vZGVsIGluc3RhbmNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBjb3VudGAg4oCTIGB7bnVtYmVyPX1gIC0gXG4gICAgICAgICAqL1xuICAgICAgICBcImNvdW50XCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9pbWFnZXMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI3Byb3RvdHlwZSR1cGRhdGVBdHRyaWJ1dGVzXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBVcGRhdGUgYXR0cmlidXRlcyBmb3IgYSBtb2RlbCBpbnN0YW5jZSBhbmQgcGVyc2lzdCBpdCBpbnRvIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBQZXJzaXN0ZWRNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvaW1hZ2VzLzppZFwiLFxuICAgICAgICAgIG1ldGhvZDogXCJQVVRcIlxuICAgICAgICB9LFxuICAgICAgfVxuICAgICk7XG5cblxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuSW1hZ2UjdXBkYXRlT3JDcmVhdGVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYEltYWdlYCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZU9yQ3JlYXRlXCJdID0gUltcInVwc2VydFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkltYWdlI3VwZGF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNkZXN0cm95QnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5JbWFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcImRlc3Ryb3lCeUlkXCJdID0gUltcImRlbGV0ZUJ5SWRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkltYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wicmVtb3ZlQnlJZFwiXSA9IFJbXCJkZWxldGVCeUlkXCJdO1xuXG5cbiAgICAvKipcbiAgICAqIEBuZ2RvYyBwcm9wZXJ0eVxuICAgICogQG5hbWUgbGJTZXJ2aWNlcy5JbWFnZSNtb2RlbE5hbWVcbiAgICAqIEBwcm9wZXJ0eU9mIGxiU2VydmljZXMuSW1hZ2VcbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgSW1hZ2VgLlxuICAgICovXG4gICAgUi5tb2RlbE5hbWUgPSBcIkltYWdlXCI7XG5cblxuICAgIHJldHVybiBSO1xuICB9XSk7XG5cbi8qKlxuICogQG5nZG9jIG9iamVjdFxuICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3RcbiAqIEBoZWFkZXIgbGJTZXJ2aWNlcy5EaWdlc3RcbiAqIEBvYmplY3RcbiAqXG4gKiBAZGVzY3JpcHRpb25cbiAqXG4gKiBBICRyZXNvdXJjZSBvYmplY3QgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIGBEaWdlc3RgIG1vZGVsLlxuICpcbiAqICMjIEV4YW1wbGVcbiAqXG4gKiBTZWVcbiAqIHtAbGluayBodHRwOi8vZG9jcy5hbmd1bGFyanMub3JnL2FwaS9uZ1Jlc291cmNlLiRyZXNvdXJjZSNleGFtcGxlICRyZXNvdXJjZX1cbiAqIGZvciBhbiBleGFtcGxlIG9mIHVzaW5nIHRoaXMgb2JqZWN0LlxuICpcbiAqL1xubW9kdWxlLmZhY3RvcnkoXG4gIFwiRGlnZXN0XCIsXG4gIFsnTG9vcEJhY2tSZXNvdXJjZScsICdMb29wQmFja0F1dGgnLCAnJGluamVjdG9yJywgZnVuY3Rpb24oUmVzb3VyY2UsIExvb3BCYWNrQXV0aCwgJGluamVjdG9yKSB7XG4gICAgdmFyIFIgPSBSZXNvdXJjZShcbiAgICAgIHVybEJhc2UgKyBcIi9kaWdlc3RzLzppZFwiLFxuICAgICAgeyAnaWQnOiAnQGlkJyB9LFxuICAgICAge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2NyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiB0aGUgbW9kZWwgYW5kIHBlcnNpc3QgaXQgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJjcmVhdGVcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjdXBzZXJ0XG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGFuIGV4aXN0aW5nIG1vZGVsIGluc3RhbmNlIG9yIGluc2VydCBhIG5ldyBvbmUgaW50byB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAgVGhpcyBtZXRob2QgZG9lcyBub3QgYWNjZXB0IGFueSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiAgIFN1cHBseSBhbiBlbXB0eSBvYmplY3Qgb3Igb21pdCB0aGlzIGFyZ3VtZW50IGFsdG9nZXRoZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cHNlcnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNleGlzdHNcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDaGVjayB3aGV0aGVyIGEgbW9kZWwgaW5zdGFuY2UgZXhpc3RzIGluIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEYXRhIHByb3BlcnRpZXM6XG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBleGlzdHNgIOKAkyBge2Jvb2xlYW49fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiZXhpc3RzXCI6IHtcbiAgICAgICAgICB1cmw6IHVybEJhc2UgKyBcIi9kaWdlc3RzLzppZC9leGlzdHNcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNmaW5kQnlJZFxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIEZpbmQgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgZmlsdGVyYCDigJMgYHtvYmplY3Q9fWAgLSBGaWx0ZXIgZGVmaW5pbmcgZmllbGRzIGFuZCBpbmNsdWRlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJmaW5kQnlJZFwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNmaW5kXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRmluZCBhbGwgaW5zdGFuY2VzIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKEFycmF5LjxPYmplY3Q+LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheS48T2JqZWN0Pn0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogPGVtPlxuICAgICAgICAgKiAoVGhlIHJlbW90ZSBtZXRob2QgZGVmaW5pdGlvbiBkb2VzIG5vdCBwcm92aWRlIGFueSBkZXNjcmlwdGlvbi5cbiAgICAgICAgICogVGhpcyB1c3VhbGx5IG1lYW5zIHRoZSByZXNwb25zZSBpcyBhIGBEaWdlc3RgIG9iamVjdC4pXG4gICAgICAgICAqIDwvZW0+XG4gICAgICAgICAqL1xuICAgICAgICBcImZpbmRcIjoge1xuICAgICAgICAgIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0c1wiLFxuICAgICAgICAgIG1ldGhvZDogXCJHRVRcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2ZpbmRPbmVcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBGaW5kIGZpcnN0IGluc3RhbmNlIG9mIHRoZSBtb2RlbCBtYXRjaGVkIGJ5IGZpbHRlciBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGZpbHRlcmAg4oCTIGB7b2JqZWN0PX1gIC0gRmlsdGVyIGRlZmluaW5nIGZpZWxkcywgd2hlcmUsIGluY2x1ZGUsIG9yZGVyLCBvZmZzZXQsIGFuZCBsaW1pdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFwiZmluZE9uZVwiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy9maW5kT25lXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkdFVFwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjdXBkYXRlQWxsXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgXCJ1cGRhdGVBbGxcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvdXBkYXRlXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I2RlbGV0ZUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBcImRlbGV0ZUJ5SWRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvOmlkXCIsXG4gICAgICAgICAgbWV0aG9kOiBcIkRFTEVURVwiXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjY291bnRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBDb3VudCBpbnN0YW5jZXMgb2YgdGhlIG1vZGVsIG1hdGNoZWQgYnkgd2hlcmUgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGB3aGVyZWAg4oCTIGB7b2JqZWN0PX1gIC0gQ3JpdGVyaWEgdG8gbWF0Y2ggbW9kZWwgaW5zdGFuY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIERhdGEgcHJvcGVydGllczpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGNvdW50YCDigJMgYHtudW1iZXI9fWAgLSBcbiAgICAgICAgICovXG4gICAgICAgIFwiY291bnRcIjoge1xuICAgICAgICAgIHVybDogdXJsQmFzZSArIFwiL2RpZ2VzdHMvY291bnRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiR0VUXCJcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1xuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhdHRyaWJ1dGVzIGZvciBhIG1vZGVsIGluc3RhbmNlIGFuZCBwZXJzaXN0IGl0IGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBgaWRgIOKAkyBgeyp9YCAtIFBlcnNpc3RlZE1vZGVsIGlkXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb3N0RGF0YSBSZXF1ZXN0IGRhdGEuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRoaXMgbWV0aG9kIGV4cGVjdHMgYSBzdWJzZXQgb2YgbW9kZWwgcHJvcGVydGllcyBhcyByZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0LE9iamVjdCk9fSBzdWNjZXNzQ2JcbiAgICAgICAgICogICBTdWNjZXNzIGNhbGxiYWNrIHdpdGggdHdvIGFyZ3VtZW50czogYHZhbHVlYCwgYHJlc3BvbnNlSGVhZGVyc2AuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7ZnVuY3Rpb24oT2JqZWN0KT19IGVycm9yQ2IgRXJyb3IgY2FsbGJhY2sgd2l0aCBvbmUgYXJndW1lbnQ6XG4gICAgICAgICAqICAgYGh0dHBSZXNwb25zZWAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IEFuIGVtcHR5IHJlZmVyZW5jZSB0aGF0IHdpbGwgYmVcbiAgICAgICAgICogICBwb3B1bGF0ZWQgd2l0aCB0aGUgYWN0dWFsIGRhdGEgb25jZSB0aGUgcmVzcG9uc2UgaXMgcmV0dXJuZWRcbiAgICAgICAgICogICBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIDxlbT5cbiAgICAgICAgICogKFRoZSByZW1vdGUgbWV0aG9kIGRlZmluaXRpb24gZG9lcyBub3QgcHJvdmlkZSBhbnkgZGVzY3JpcHRpb24uXG4gICAgICAgICAqIFRoaXMgdXN1YWxseSBtZWFucyB0aGUgcmVzcG9uc2UgaXMgYSBgRGlnZXN0YCBvYmplY3QuKVxuICAgICAgICAgKiA8L2VtPlxuICAgICAgICAgKi9cbiAgICAgICAgXCJwcm90b3R5cGUkdXBkYXRlQXR0cmlidXRlc1wiOiB7XG4gICAgICAgICAgdXJsOiB1cmxCYXNlICsgXCIvZGlnZXN0cy86aWRcIixcbiAgICAgICAgICBtZXRob2Q6IFwiUFVUXCJcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG5cblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCN1cGRhdGVPckNyZWF0ZVxuICAgICAgICAgKiBAbWV0aG9kT2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAgICAgICpcbiAgICAgICAgICogQGRlc2NyaXB0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVwZGF0ZSBhbiBleGlzdGluZyBtb2RlbCBpbnN0YW5jZSBvciBpbnNlcnQgYSBuZXcgb25lIGludG8gdGhlIGRhdGEgc291cmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdD19IHBhcmFtZXRlcnMgUmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiAgIFRoaXMgbWV0aG9kIGRvZXMgbm90IGFjY2VwdCBhbnkgcGFyYW1ldGVycy5cbiAgICAgICAgICogICBTdXBwbHkgYW4gZW1wdHkgb2JqZWN0IG9yIG9taXQgdGhpcyBhcmd1bWVudCBhbHRvZ2V0aGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcG9zdERhdGEgUmVxdWVzdCBkYXRhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCBleHBlY3RzIGEgc3Vic2V0IG9mIG1vZGVsIHByb3BlcnRpZXMgYXMgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiA8ZW0+XG4gICAgICAgICAqIChUaGUgcmVtb3RlIG1ldGhvZCBkZWZpbml0aW9uIGRvZXMgbm90IHByb3ZpZGUgYW55IGRlc2NyaXB0aW9uLlxuICAgICAgICAgKiBUaGlzIHVzdWFsbHkgbWVhbnMgdGhlIHJlc3BvbnNlIGlzIGEgYERpZ2VzdGAgb2JqZWN0LilcbiAgICAgICAgICogPC9lbT5cbiAgICAgICAgICovXG4gICAgICAgIFJbXCJ1cGRhdGVPckNyZWF0ZVwiXSA9IFJbXCJ1cHNlcnRcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjdXBkYXRlXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogVXBkYXRlIGluc3RhbmNlcyBvZiB0aGUgbW9kZWwgbWF0Y2hlZCBieSB3aGVyZSBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYHdoZXJlYCDigJMgYHtvYmplY3Q9fWAgLSBDcml0ZXJpYSB0byBtYXRjaCBtb2RlbCBpbnN0YW5jZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHBvc3REYXRhIFJlcXVlc3QgZGF0YS5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgZXhwZWN0cyBhIHN1YnNldCBvZiBtb2RlbCBwcm9wZXJ0aWVzIGFzIHJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInVwZGF0ZVwiXSA9IFJbXCJ1cGRhdGVBbGxcIl07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgICAgICogQG5hbWUgbGJTZXJ2aWNlcy5EaWdlc3QjZGVzdHJveUJ5SWRcbiAgICAgICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuRGlnZXN0XG4gICAgICAgICAqXG4gICAgICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWxldGUgYSBtb2RlbCBpbnN0YW5jZSBieSBpZCBmcm9tIHRoZSBkYXRhIHNvdXJjZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3Q9fSBwYXJhbWV0ZXJzIFJlcXVlc3QgcGFyYW1ldGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogIC0gYGlkYCDigJMgYHsqfWAgLSBNb2RlbCBpZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCxPYmplY3QpPX0gc3VjY2Vzc0NiXG4gICAgICAgICAqICAgU3VjY2VzcyBjYWxsYmFjayB3aXRoIHR3byBhcmd1bWVudHM6IGB2YWx1ZWAsIGByZXNwb25zZUhlYWRlcnNgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9uKE9iamVjdCk9fSBlcnJvckNiIEVycm9yIGNhbGxiYWNrIHdpdGggb25lIGFyZ3VtZW50OlxuICAgICAgICAgKiAgIGBodHRwUmVzcG9uc2VgLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBBbiBlbXB0eSByZWZlcmVuY2UgdGhhdCB3aWxsIGJlXG4gICAgICAgICAqICAgcG9wdWxhdGVkIHdpdGggdGhlIGFjdHVhbCBkYXRhIG9uY2UgdGhlIHJlc3BvbnNlIGlzIHJldHVybmVkXG4gICAgICAgICAqICAgZnJvbSB0aGUgc2VydmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGlzIG1ldGhvZCByZXR1cm5zIG5vIGRhdGEuXG4gICAgICAgICAqL1xuICAgICAgICBSW1wiZGVzdHJveUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQG5nZG9jIG1ldGhvZFxuICAgICAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkRpZ2VzdCNyZW1vdmVCeUlkXG4gICAgICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkRpZ2VzdFxuICAgICAgICAgKlxuICAgICAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgICAgICpcbiAgICAgICAgICogRGVsZXRlIGEgbW9kZWwgaW5zdGFuY2UgYnkgaWQgZnJvbSB0aGUgZGF0YSBzb3VyY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0PX0gcGFyYW1ldGVycyBSZXF1ZXN0IHBhcmFtZXRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqICAtIGBpZGAg4oCTIGB7Kn1gIC0gTW9kZWwgaWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QsT2JqZWN0KT19IHN1Y2Nlc3NDYlxuICAgICAgICAgKiAgIFN1Y2Nlc3MgY2FsbGJhY2sgd2l0aCB0d28gYXJndW1lbnRzOiBgdmFsdWVgLCBgcmVzcG9uc2VIZWFkZXJzYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtmdW5jdGlvbihPYmplY3QpPX0gZXJyb3JDYiBFcnJvciBjYWxsYmFjayB3aXRoIG9uZSBhcmd1bWVudDpcbiAgICAgICAgICogICBgaHR0cFJlc3BvbnNlYC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gQW4gZW1wdHkgcmVmZXJlbmNlIHRoYXQgd2lsbCBiZVxuICAgICAgICAgKiAgIHBvcHVsYXRlZCB3aXRoIHRoZSBhY3R1YWwgZGF0YSBvbmNlIHRoZSByZXNwb25zZSBpcyByZXR1cm5lZFxuICAgICAgICAgKiAgIGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogVGhpcyBtZXRob2QgcmV0dXJucyBubyBkYXRhLlxuICAgICAgICAgKi9cbiAgICAgICAgUltcInJlbW92ZUJ5SWRcIl0gPSBSW1wiZGVsZXRlQnlJZFwiXTtcblxuXG4gICAgLyoqXG4gICAgKiBAbmdkb2MgcHJvcGVydHlcbiAgICAqIEBuYW1lIGxiU2VydmljZXMuRGlnZXN0I21vZGVsTmFtZVxuICAgICogQHByb3BlcnR5T2YgbGJTZXJ2aWNlcy5EaWdlc3RcbiAgICAqIEBkZXNjcmlwdGlvblxuICAgICogVGhlIG5hbWUgb2YgdGhlIG1vZGVsIHJlcHJlc2VudGVkIGJ5IHRoaXMgJHJlc291cmNlLFxuICAgICogaS5lLiBgRGlnZXN0YC5cbiAgICAqL1xuICAgIFIubW9kZWxOYW1lID0gXCJEaWdlc3RcIjtcblxuXG4gICAgcmV0dXJuIFI7XG4gIH1dKTtcblxuXG5tb2R1bGVcbiAgLmZhY3RvcnkoJ0xvb3BCYWNrQXV0aCcsIGZ1bmN0aW9uKCkge1xuICAgIHZhciBwcm9wcyA9IFsnYWNjZXNzVG9rZW5JZCcsICdjdXJyZW50VXNlcklkJ107XG4gICAgdmFyIHByb3BzUHJlZml4ID0gJyRMb29wQmFjayQnO1xuXG4gICAgZnVuY3Rpb24gTG9vcEJhY2tBdXRoKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgcHJvcHMuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHNlbGZbbmFtZV0gPSBsb2FkKG5hbWUpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLnJlbWVtYmVyTWUgPSB1bmRlZmluZWQ7XG4gICAgICB0aGlzLmN1cnJlbnRVc2VyRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgTG9vcEJhY2tBdXRoLnByb3RvdHlwZS5zYXZlID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgc3RvcmFnZSA9IHRoaXMucmVtZW1iZXJNZSA/IGxvY2FsU3RvcmFnZSA6IHNlc3Npb25TdG9yYWdlO1xuICAgICAgcHJvcHMuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHNhdmUoc3RvcmFnZSwgbmFtZSwgc2VsZltuYW1lXSk7XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgTG9vcEJhY2tBdXRoLnByb3RvdHlwZS5zZXRVc2VyID0gZnVuY3Rpb24oYWNjZXNzVG9rZW5JZCwgdXNlcklkLCB1c2VyRGF0YSkge1xuICAgICAgdGhpcy5hY2Nlc3NUb2tlbklkID0gYWNjZXNzVG9rZW5JZDtcbiAgICAgIHRoaXMuY3VycmVudFVzZXJJZCA9IHVzZXJJZDtcbiAgICAgIHRoaXMuY3VycmVudFVzZXJEYXRhID0gdXNlckRhdGE7XG4gICAgfVxuXG4gICAgTG9vcEJhY2tBdXRoLnByb3RvdHlwZS5jbGVhclVzZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuYWNjZXNzVG9rZW5JZCA9IG51bGw7XG4gICAgICB0aGlzLmN1cnJlbnRVc2VySWQgPSBudWxsO1xuICAgICAgdGhpcy5jdXJyZW50VXNlckRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIExvb3BCYWNrQXV0aC5wcm90b3R5cGUuY2xlYXJTdG9yYWdlID0gZnVuY3Rpb24oKSB7XG4gICAgICBwcm9wcy5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgc2F2ZShzZXNzaW9uU3RvcmFnZSwgbmFtZSwgbnVsbCk7XG4gICAgICAgIHNhdmUobG9jYWxTdG9yYWdlLCBuYW1lLCBudWxsKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IExvb3BCYWNrQXV0aCgpO1xuXG4gICAgLy8gTm90ZTogTG9jYWxTdG9yYWdlIGNvbnZlcnRzIHRoZSB2YWx1ZSB0byBzdHJpbmdcbiAgICAvLyBXZSBhcmUgdXNpbmcgZW1wdHkgc3RyaW5nIGFzIGEgbWFya2VyIGZvciBudWxsL3VuZGVmaW5lZCB2YWx1ZXMuXG4gICAgZnVuY3Rpb24gc2F2ZShzdG9yYWdlLCBuYW1lLCB2YWx1ZSkge1xuICAgICAgdmFyIGtleSA9IHByb3BzUHJlZml4ICsgbmFtZTtcbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB2YWx1ZSA9ICcnO1xuICAgICAgc3RvcmFnZVtrZXldID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZChuYW1lKSB7XG4gICAgICB2YXIga2V5ID0gcHJvcHNQcmVmaXggKyBuYW1lO1xuICAgICAgcmV0dXJuIGxvY2FsU3RvcmFnZVtrZXldIHx8IHNlc3Npb25TdG9yYWdlW2tleV0gfHwgbnVsbDtcbiAgICB9XG4gIH0pXG4gIC5jb25maWcoWyckaHR0cFByb3ZpZGVyJywgZnVuY3Rpb24oJGh0dHBQcm92aWRlcikge1xuICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goJ0xvb3BCYWNrQXV0aFJlcXVlc3RJbnRlcmNlcHRvcicpO1xuICB9XSlcbiAgLmZhY3RvcnkoJ0xvb3BCYWNrQXV0aFJlcXVlc3RJbnRlcmNlcHRvcicsIFsgJyRxJywgJ0xvb3BCYWNrQXV0aCcsXG4gICAgZnVuY3Rpb24oJHEsIExvb3BCYWNrQXV0aCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgJ3JlcXVlc3QnOiBmdW5jdGlvbihjb25maWcpIHtcblxuICAgICAgICAgIC8vIGZpbHRlciBvdXQgbm9uIHVybEJhc2UgcmVxdWVzdHNcbiAgICAgICAgICBpZiAoY29uZmlnLnVybC5zdWJzdHIoMCwgdXJsQmFzZS5sZW5ndGgpICE9PSB1cmxCYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gY29uZmlnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChMb29wQmFja0F1dGguYWNjZXNzVG9rZW5JZCkge1xuICAgICAgICAgICAgY29uZmlnLmhlYWRlcnNbYXV0aEhlYWRlcl0gPSBMb29wQmFja0F1dGguYWNjZXNzVG9rZW5JZDtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNvbmZpZy5fX2lzR2V0Q3VycmVudFVzZXJfXykge1xuICAgICAgICAgICAgLy8gUmV0dXJuIGEgc3R1YiA0MDEgZXJyb3IgZm9yIFVzZXIuZ2V0Q3VycmVudCgpIHdoZW5cbiAgICAgICAgICAgIC8vIHRoZXJlIGlzIG5vIHVzZXIgbG9nZ2VkIGluXG4gICAgICAgICAgICB2YXIgcmVzID0ge1xuICAgICAgICAgICAgICBib2R5OiB7IGVycm9yOiB7IHN0YXR1czogNDAxIH0gfSxcbiAgICAgICAgICAgICAgc3RhdHVzOiA0MDEsXG4gICAgICAgICAgICAgIGNvbmZpZzogY29uZmlnLFxuICAgICAgICAgICAgICBoZWFkZXJzOiBmdW5jdGlvbigpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QocmVzKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGNvbmZpZyB8fCAkcS53aGVuKGNvbmZpZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XSlcblxuICAvKipcbiAgICogQG5nZG9jIG9iamVjdFxuICAgKiBAbmFtZSBsYlNlcnZpY2VzLkxvb3BCYWNrUmVzb3VyY2VQcm92aWRlclxuICAgKiBAaGVhZGVyIGxiU2VydmljZXMuTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyXG4gICAqIEBkZXNjcmlwdGlvblxuICAgKiBVc2UgYExvb3BCYWNrUmVzb3VyY2VQcm92aWRlcmAgdG8gY2hhbmdlIHRoZSBnbG9iYWwgY29uZmlndXJhdGlvblxuICAgKiBzZXR0aW5ncyB1c2VkIGJ5IGFsbCBtb2RlbHMuIE5vdGUgdGhhdCB0aGUgcHJvdmlkZXIgaXMgYXZhaWxhYmxlXG4gICAqIHRvIENvbmZpZ3VyYXRpb24gQmxvY2tzIG9ubHksIHNlZVxuICAgKiB7QGxpbmsgaHR0cHM6Ly9kb2NzLmFuZ3VsYXJqcy5vcmcvZ3VpZGUvbW9kdWxlI21vZHVsZS1sb2FkaW5nLWRlcGVuZGVuY2llcyBNb2R1bGUgTG9hZGluZyAmIERlcGVuZGVuY2llc31cbiAgICogZm9yIG1vcmUgZGV0YWlscy5cbiAgICpcbiAgICogIyMgRXhhbXBsZVxuICAgKlxuICAgKiBgYGBqc1xuICAgKiBhbmd1bGFyLm1vZHVsZSgnYXBwJylcbiAgICogIC5jb25maWcoZnVuY3Rpb24oTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyKSB7XG4gICAqICAgICBMb29wQmFja1Jlc291cmNlUHJvdmlkZXIuc2V0QXV0aEhlYWRlcignWC1BY2Nlc3MtVG9rZW4nKTtcbiAgICogIH0pO1xuICAgKiBgYGBcbiAgICovXG4gIC5wcm92aWRlcignTG9vcEJhY2tSZXNvdXJjZScsIGZ1bmN0aW9uIExvb3BCYWNrUmVzb3VyY2VQcm92aWRlcigpIHtcbiAgICAvKipcbiAgICAgKiBAbmdkb2MgbWV0aG9kXG4gICAgICogQG5hbWUgbGJTZXJ2aWNlcy5Mb29wQmFja1Jlc291cmNlUHJvdmlkZXIjc2V0QXV0aEhlYWRlclxuICAgICAqIEBtZXRob2RPZiBsYlNlcnZpY2VzLkxvb3BCYWNrUmVzb3VyY2VQcm92aWRlclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBoZWFkZXIgVGhlIGhlYWRlciBuYW1lIHRvIHVzZSwgZS5nLiBgWC1BY2Nlc3MtVG9rZW5gXG4gICAgICogQGRlc2NyaXB0aW9uXG4gICAgICogQ29uZmlndXJlIHRoZSBSRVNUIHRyYW5zcG9ydCB0byB1c2UgYSBkaWZmZXJlbnQgaGVhZGVyIGZvciBzZW5kaW5nXG4gICAgICogdGhlIGF1dGhlbnRpY2F0aW9uIHRva2VuLiBJdCBpcyBzZW50IGluIHRoZSBgQXV0aG9yaXphdGlvbmAgaGVhZGVyXG4gICAgICogYnkgZGVmYXVsdC5cbiAgICAgKi9cbiAgICB0aGlzLnNldEF1dGhIZWFkZXIgPSBmdW5jdGlvbihoZWFkZXIpIHtcbiAgICAgIGF1dGhIZWFkZXIgPSBoZWFkZXI7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBuZ2RvYyBtZXRob2RcbiAgICAgKiBAbmFtZSBsYlNlcnZpY2VzLkxvb3BCYWNrUmVzb3VyY2VQcm92aWRlciNzZXRVcmxCYXNlXG4gICAgICogQG1ldGhvZE9mIGxiU2VydmljZXMuTG9vcEJhY2tSZXNvdXJjZVByb3ZpZGVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgVVJMIHRvIHVzZSwgZS5nLiBgL2FwaWAgb3IgYC8vZXhhbXBsZS5jb20vYXBpYC5cbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKiBDaGFuZ2UgdGhlIFVSTCBvZiB0aGUgUkVTVCBBUEkgc2VydmVyLiBCeSBkZWZhdWx0LCB0aGUgVVJMIHByb3ZpZGVkXG4gICAgICogdG8gdGhlIGNvZGUgZ2VuZXJhdG9yIChgbGItbmdgIG9yIGBncnVudC1sb29wYmFjay1zZGstYW5ndWxhcmApIGlzIHVzZWQuXG4gICAgICovXG4gICAgdGhpcy5zZXRVcmxCYXNlID0gZnVuY3Rpb24odXJsKSB7XG4gICAgICB1cmxCYXNlID0gdXJsO1xuICAgIH07XG5cbiAgICB0aGlzLiRnZXQgPSBbJyRyZXNvdXJjZScsIGZ1bmN0aW9uKCRyZXNvdXJjZSkge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uKHVybCwgcGFyYW1zLCBhY3Rpb25zKSB7XG4gICAgICAgIHZhciByZXNvdXJjZSA9ICRyZXNvdXJjZSh1cmwsIHBhcmFtcywgYWN0aW9ucyk7XG5cbiAgICAgICAgLy8gQW5ndWxhciBhbHdheXMgY2FsbHMgUE9TVCBvbiAkc2F2ZSgpXG4gICAgICAgIC8vIFRoaXMgaGFjayBpcyBiYXNlZCBvblxuICAgICAgICAvLyBodHRwOi8va2lya2J1c2hlbGwubWUvYW5ndWxhci1qcy11c2luZy1uZy1yZXNvdXJjZS1pbi1hLW1vcmUtcmVzdGZ1bC1tYW5uZXIvXG4gICAgICAgIHJlc291cmNlLnByb3RvdHlwZS4kc2F2ZSA9IGZ1bmN0aW9uKHN1Y2Nlc3MsIGVycm9yKSB7XG4gICAgICAgICAgLy8gRm9ydHVuYXRlbHksIExvb3BCYWNrIHByb3ZpZGVzIGEgY29udmVuaWVudCBgdXBzZXJ0YCBtZXRob2RcbiAgICAgICAgICAvLyB0aGF0IGV4YWN0bHkgZml0cyBvdXIgbmVlZHMuXG4gICAgICAgICAgdmFyIHJlc3VsdCA9IHJlc291cmNlLnVwc2VydC5jYWxsKHRoaXMsIHt9LCB0aGlzLCBzdWNjZXNzLCBlcnJvcik7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdC4kcHJvbWlzZSB8fCByZXN1bHQ7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiByZXNvdXJjZTtcbiAgICAgIH07XG4gICAgfV07XG4gIH0pO1xuXG59KSh3aW5kb3csIHdpbmRvdy5hbmd1bGFyKTtcbiIsImFwcC5zZXJ2aWNlKCdwbl9jbG91ZGluYXJ5JywgZnVuY3Rpb24oJGluamVjdG9yKSB7XG4gICAgdmFyIHBob3RvcyA9IFtdLFxuICAgICAgJGh0dHAgID0gJGluamVjdG9yLmdldCgnJGh0dHAnKSxcbiAgICAgICRxICA9ICRpbmplY3Rvci5nZXQoJyRxJyksXG4gICAgICAkbWREaWFsb2cgID0gJGluamVjdG9yLmdldCgnJG1kRGlhbG9nJyksXG4gICAgICAkdGltZW91dCAgPSAkaW5qZWN0b3IuZ2V0KCckdGltZW91dCcpLFxuICAgICAgJGh0dHAgID0gJGluamVjdG9yLmdldCgnJGh0dHAnKSxcbiAgICAgIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgIHRoaXMuYWxidW0gPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgdXJsID0gJC5jbG91ZGluYXJ5LnVybChuYW1lLCB7Zm9ybWF0OiAnanNvbicsIHR5cGU6ICdsaXN0J30pO1xuICAgICAgLy9jYWNoZSBidXN0XG4gICAgICB1cmwgPSB1cmwgKyBcIj9cIiArIE1hdGguY2VpbChuZXcgRGF0ZSgpLmdldFRpbWUoKSAvIDEwMDApO1xuXG4gICAgICAkaHR0cFxuICAgICAgICAuZ2V0KHVybClcbiAgICAgICAgLnN1Y2Nlc3MoZnVuY3Rpb24ocmVzcG9uc2Upe1xuICAgICAgICAgIHBob3RvcyA9IHJlc3BvbnNlLnJlc291cmNlcztcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHBob3Rvcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgdGhpcy5waG90b3MgPSBmdW5jdGlvbihuYW1lLCBmb3JjZWRSZWZyZXNoKSB7XG4gICAgICBpZighZm9yY2VkUmVmcmVzaCAmJiBwaG90b3MgJiYgcGhvdG9zLmxlbmd0aCl7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHBob3Rvcyk7XG4gICAgICAgIH0sIDEpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgIH1lbHNle1xuICAgICAgICByZXR1cm4gdGhpcy5hbGJ1bShuYW1lKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy51cGxvYWQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGNsb3VkaW5hcnkub3BlblVwbG9hZFdpZGdldCh7XG4gICAgICAgICAgY2xvdWRfbmFtZTogJC5jbG91ZGluYXJ5LmNvbmZpZygpLmNsb3VkX25hbWUsXG4gICAgICAgICAgdXBsb2FkX3ByZXNldDogJC5jbG91ZGluYXJ5LmNvbmZpZygpLnVwbG9hZF9wcmVzZXQsXG4gICAgICAgICAgdGhlbWU6ICdtaW5pbWFsJ1xuICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIHRoaXMubGlicmFyeSA9IGZ1bmN0aW9uKGV2KXtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHJldHVybiAkbWREaWFsb2cuc2hvdyh7XG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJG1kRGlhbG9nLCAkY29udHJvbGxlcil7XG4gICAgICAgICAgJGNvbnRyb2xsZXIoJ0RpYWxvZ0NvbnRyb2xsZXInLCB7XG4gICAgICAgICAgICAnJHNjb3BlJzogJHNjb3BlLFxuICAgICAgICAgICAgJyRtZERpYWxvZyc6ICRtZERpYWxvZ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgJHNjb3BlLnBob3Rvcz0gW107XG4gICAgICAgICAgJHNjb3BlLndoZW5Mb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAkc2NvcGUuaXNTZWxlY3RlZCA9IGZ1bmN0aW9uKHBob3RvX2lkKXtcbiAgICAgICAgICAgIHJldHVybiAoJHNjb3BlLnNlbGVjdGVkUGhvdG8gJiYgcGhvdG9faWQgJiYgKCRzY29wZS5zZWxlY3RlZFBob3RvID09PSBwaG90b19pZCkpPyAncGhvdG8tc2VsZWN0ZWQnOiAnJztcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgJHNjb3BlLnNlbGVjdCA9IGZ1bmN0aW9uKHBob3RvX2lkLCBlKXtcbiAgICAgICAgICAgICRzY29wZS5zZWxlY3RlZFBob3RvID0gcGhvdG9faWQ7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgICRzY29wZS51cGxvYWQgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi51cGxvYWQoZnVuY3Rpb24oZXJyb3IsIHBob3Rvcykge1xuICAgICAgICAgICAgICAkc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgJHNjb3BlLnBob3RvcyA9ICRzY29wZS5waG90b3MuY29uY2F0KHBob3Rvcyk7XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgJHNjb3BlLnJlZnJlc2ggPSBmdW5jdGlvbihmb3JjZWRSZWZyZXNoKXtcbiAgICAgICAgICAgICRzY29wZS53aGVuTG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICBmb3JjZWRSZWZyZXNoID0gKGFuZ3VsYXIuaXNEZWZpbmVkKGZvcmNlZFJlZnJlc2gpKT8gZm9yY2VkUmVmcmVzaCA6IGZhbHNlO1xuICAgICAgICAgICAgc2VsZlxuICAgICAgICAgICAgICAucGhvdG9zKCdteXBob3RvYWxidW0nLCBmb3JjZWRSZWZyZXNoKVxuICAgICAgICAgICAgICAudGhlbihmdW5jdGlvbihwaG90b3MpIHtcbiAgICAgICAgICAgICAgICAkdGltZW91dChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgJHNjb3BlLndoZW5Mb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAkc2NvcGUucGhvdG9zID0gcGhvdG9zO1xuICAgICAgICAgICAgICAgIH0sIDEwKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfTtcbiAgICAgICAgICAvLyBvbiAnT0sgYnRuIGNsaWNrXG4gICAgICAgICAgJHNjb3BlLm9rID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAkbWREaWFsb2cuaGlkZSgkc2NvcGUuc2VsZWN0ZWRQaG90byk7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgICRzY29wZS5yZWZyZXNoKCk7XG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvdGVtcGxhdGVzL3Bob3RvLWFsYnVtLW1vZGFsLmh0bWwnLFxuICAgICAgICBwYXJlbnQ6IGFuZ3VsYXIuZWxlbWVudChkb2N1bWVudC5ib2R5KSxcbiAgICAgICAgdGFyZ2V0RXZlbnQ6IGV2XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0pOyIsIiAgYXBwLnNlcnZpY2UoJ1Bvc3RTZXJ2aWNlJywgZnVuY3Rpb24oJGluamVjdG9yKXtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhclxuICAgIFBvc3RNb2RlbCA9ICRpbmplY3Rvci5nZXQoJ1Bvc3QnKSxcbiAgICAkbWREaWFsb2cgPSAkaW5qZWN0b3IuZ2V0KCckbWREaWFsb2cnKSxcbiAgICAkcSA9ICRpbmplY3Rvci5nZXQoJyRxJyksXG4gICAgJG1kVG9hc3QgPSAkaW5qZWN0b3IuZ2V0KCckbWRUb2FzdCcpLFxuICAgIGxpbWl0ID0gMTAsXG4gICAgc2tpcCA9IDE7XG5cbiAgdmFyIGV4cG9ydHMgPSB7XG4gICAgd2hlcmU6IHt9XG4gIH07XG5cbiAgZXhwb3J0cy5xdWVyeSA9IHtcbiAgICBmaWx0ZXI6IHtcbiAgICAgIG9yZGVyOiAncHVibGlzaGVkX3RpbWUgREVTQycsXG4gICAgICBsaW1pdDogbGltaXQsXG4gICAgICBza2lwOiBza2lwLFxuICAgICAgd2hlcmU6IGV4cG9ydHMud2hlcmVcbiAgICB9XG4gIH07XG5cbiAgZXhwb3J0cy5zZXR1cCA9IGZ1bmN0aW9uKHNjb3BlKXtcbiAgICBzY29wZS5wb3N0cyA9IFtdO1xuICAgIHNjb3BlLnRvdGFsID0gMDtcbiAgICBzY29wZS5xdWVyeSA9IGV4cG9ydHMucXVlcnk7XG5cbiAgICBzY29wZS5vbk9yZGVyQ2hhbmdlID0gZnVuY3Rpb24oKXtcbiAgICAgIGV4cG9ydHMub25PcmRlckNoYW5nZS5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgc2NvcGUuc2VhcmNoKCk7XG4gICAgfTtcblxuICAgIHNjb3BlLm9uUGFnaW5hdGlvbkNoYW5nZSA9IGZ1bmN0aW9uKCl7XG4gICAgICBleHBvcnRzLm9uUGFnaW5hdGlvbkNoYW5nZS5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgc2NvcGUuc2VhcmNoKCk7XG4gICAgfTtcblxuICAgIHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKCkge1xuICAgICAgc2NvcGUuZGVmZXJyZWQgPSBleHBvcnRzLmZldGNoKClcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgICAgc2NvcGUucG9zdHMgPSBkYXRhLnBvc3RzO1xuICAgICAgICAgIHNjb3BlLnRvdGFsID0gZGF0YS50b3RhbDtcbiAgICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBzY29wZS5kZWZlcnJlZDtcbiAgICB9O1xuICB9O1xuXG4gIGV4cG9ydHMuc2V0ID0gZnVuY3Rpb24odHlwZSwgdmFsdWUpe1xuICAgIGV4cG9ydHNbdHlwZV0gPSB2YWx1ZTtcbiAgfTtcblxuICAvLyBpbiB0aGUgZnV0dXJlIHdlIG1heSBzZWUgYSBmZXcgYnVpbHQgaW4gYWx0ZXJuYXRlIGhlYWRlcnMgYnV0IGluIHRoZSBtZWFuIHRpbWVcbiAgLy8geW91IGNhbiBpbXBsZW1lbnQgeW91ciBvd24gc2VhcmNoIGhlYWRlciBhbmQgZG8gc29tZXRoaW5nIGxpa2VcbiAgZXhwb3J0cy5mZXRjaCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG4gICAgUG9zdE1vZGVsLmNvdW50KGZhbHNlLCBmdW5jdGlvbihlKXtcbiAgICAgIGV4cG9ydHMucXVlcnkgPSB7XG4gICAgICAgIGZpbHRlcjoge1xuICAgICAgICAgIG9yZGVyOiAncHVibGlzaGVkX3RpbWUgREVTQycsXG4gICAgICAgICAgbGltaXQ6IGxpbWl0LFxuICAgICAgICAgIHNraXA6IHNraXAsXG4gICAgICAgICAgd2hlcmU6IGV4cG9ydHMud2hlcmVcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgUG9zdE1vZGVsLmZpbmQoZXhwb3J0cy5xdWVyeSwgZnVuY3Rpb24ocG9zdHMpe1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICBwb3N0czogYW5ndWxhci5jb3B5KHBvc3RzKSxcbiAgICAgICAgICB0b3RhbDogZS5jb3VudFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gIH07XG5cbiAgZXhwb3J0cy5vbk9yZGVyQ2hhbmdlID0gZnVuY3Rpb24ob3JkZXIpIHtcbiAgICBpZihvcmRlci5jaGFyQXQoMCkgPT09ICctJyl7XG4gICAgICBleHBvcnRzLnF1ZXJ5LmZpbHRlci5vcmRlciA9IG9yZGVyLnN1YnN0cigxLCBvcmRlci5sZW5ndGgtMSkgKyAnIERFU0MnO1xuICAgIH1cbiAgfTtcblxuICBleHBvcnRzLm9uUGFnaW5hdGlvbkNoYW5nZSA9IGZ1bmN0aW9uKF9za2lwLCBfbGltaXQpIHtcbiAgICBza2lwID0gX3NraXA7XG4gICAgbGltaXQgPSBfbGltaXQ7XG4gIH07XG5cbiAgZXhwb3J0cy5saWJyYXJ5ID0gZnVuY3Rpb24oZXYsIGRpZ2VzdCl7XG4gICAgcmV0dXJuICRtZERpYWxvZy5zaG93KHtcbiAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uKCRzY29wZSwgJG1kRGlhbG9nLCAkY29udHJvbGxlciwgZGlnZXN0KXtcbiAgICAgICAgJGNvbnRyb2xsZXIoJ0RpYWxvZ0NvbnRyb2xsZXInLCB7XG4gICAgICAgICAgJyRzY29wZSc6ICRzY29wZSxcbiAgICAgICAgICAnJG1kRGlhbG9nJzogJG1kRGlhbG9nXG4gICAgICAgIH0pO1xuXG4gICAgICAgICRzY29wZS53aGVyZSA9IHtzdGF0ZTogJ1BVQkxJU0hFRCd9O1xuICAgICAgICBleHBvcnRzLnNldHVwKCRzY29wZSk7XG4gICAgICAgICRzY29wZS5zZWxlY3RlZCA9IFtdO1xuICAgICAgICAkc2NvcGUucGFyZW50TmFtZSA9ICdURVNUJztcbiAgICAgICAgJHNjb3BlLmluaXQgPSBmdW5jdGlvbigpe1xuICAgICAgICAgIHZhciBjdXJyZW50RGF5ID0gbmV3IERhdGUoZGlnZXN0LnB1Ymxpc2hlZF9kYXRlKSxcbiAgICAgICAgICAgIG5leHREYXkgPSBuZXcgRGF0ZShkaWdlc3QucHVibGlzaGVkX2RhdGUpO1xuICAgICAgICAgIG5leHREYXkuc2V0RGF0ZShuZXh0RGF5LmdldERhdGUoKSArIDEpO1xuXG4gICAgICAgICAgZXhwb3J0cy5zZXQoJ3doZXJlJywge1xuICAgICAgICAgICAgc3RhdGU6ICdQVUJMSVNIRUQnLFxuICAgICAgICAgICAgcHVibGlzaGVkX3RpbWU6IHtcbiAgICAgICAgICAgICAgYmV0d2VlbjogW2N1cnJlbnREYXksIG5leHREYXldXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAkc2NvcGUuc2VhcmNoKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgJHNjb3BlLm9rID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyIHBvc3RzID0gW107XG4gICAgICAgICAgYW5ndWxhci5mb3JFYWNoKCRzY29wZS4kJGNoaWxkVGFpbC5zZWxlY3RlZCwgZnVuY3Rpb24ocG9zdCl7XG4gICAgICAgICAgICBwb3N0cy5wdXNoKHBvc3QuaWQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgJG1kRGlhbG9nLmhpZGUocG9zdHMpO1xuICAgICAgICB9O1xuXG4gICAgICAgICRzY29wZS5pbml0KCk7XG4gICAgICB9LFxuICAgICAgbG9jYWxzOiB7IGRpZ2VzdDogZGlnZXN0IH0sXG4gICAgICB0ZW1wbGF0ZVVybDogJ2pzL3RlbXBsYXRlcy9wb3N0cy9saWJyYXJ5LW1vZGFsLmh0bWwnLFxuICAgICAgcGFyZW50OiBhbmd1bGFyLmVsZW1lbnQoZG9jdW1lbnQuYm9keSksXG4gICAgICB0YXJnZXRFdmVudDogZXZcbiAgICB9KTtcbiAgfTtcblxuICBleHBvcnRzLmZpbmRCeUlkcyA9IGZ1bmN0aW9uKGlkcyl7XG4gICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgIFBvc3RNb2RlbC5maW5kKHtcbiAgICAgIGZpbHRlcjoge1xuICAgICAgICB3aGVyZToge1xuICAgICAgICAgIGlkOiB7XG4gICAgICAgICAgICBpbnE6IGlkc1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uKHBvc3RzKXtcbiAgICAgIGRlZmVycmVkLnJlc29sdmUoYW5ndWxhci5jb3B5KHBvc3RzKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgfVxuXG4gIHJldHVybiBleHBvcnRzO1xufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
