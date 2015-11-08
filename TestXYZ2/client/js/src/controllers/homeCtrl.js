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