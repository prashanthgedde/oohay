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
