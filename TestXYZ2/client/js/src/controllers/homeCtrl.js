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