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