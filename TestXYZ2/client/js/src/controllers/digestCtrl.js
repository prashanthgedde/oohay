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