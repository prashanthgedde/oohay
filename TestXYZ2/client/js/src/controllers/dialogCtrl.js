app.controller('DialogController', function($scope, $mdDialog) {
  'use strict';

  $scope.cancel = function() {
    $mdDialog.cancel();
  };
});