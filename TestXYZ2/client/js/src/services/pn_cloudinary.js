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