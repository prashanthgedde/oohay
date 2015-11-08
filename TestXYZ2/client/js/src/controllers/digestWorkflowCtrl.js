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