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
