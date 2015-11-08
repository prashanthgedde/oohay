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