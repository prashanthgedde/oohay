app.service('DigestService', function($injector){
  'use strict';

  var
    DigestModel = $injector.get('Digest'),
    $q = $injector.get('$q'),
    $mdDialog = $injector.get('$mdDialog'),
    $mdToast = $injector.get('$mdToast'),
    query = {
      filter: {
        order: 'published_date DESC'
      }
    };

  // in the future we may see a few built in alternate headers but in the mean time
  // you can implement your own search header and do something like
  this.fetch = function() {
    var deferred = $q.defer();
    DigestModel.count(false, function(e){

      DigestModel.find(query, function(digests){
        deferred.resolve({
          digests: angular.copy(digests),
          total: e.count
        });
      });
    });

    return deferred.promise;
  };

  this.add = function(ev, digest){
    digest = digest || {
      image: ''
    };

    return $mdDialog.show({
      controller: function($scope, $mdDialog, $controller){
        $controller('DialogController', {
          '$scope': $scope,
          '$mdDialog': $mdDialog
        });

        $scope.digest = angular.copy(digest);

        // on 'OK' btn click
        $scope.ok = function() {
          DigestModel.upsert($scope.digest, $mdDialog.hide, function(err){
            console.info(err);
          });
        };
      },
      templateUrl: 'js/templates/digests/add-modal.html',
      parent: angular.element(document.body),
      targetEvent: ev
    });
  };

  this.remove = function(ev, digest) {
    var deferred = $q.defer();
    $mdDialog.show(
      $mdDialog.confirm()
        .title('Confirm!')
        .content('Are you sure want to delete the selected Digest?')
        .ok('Confirm')
        .cancel('Cancel')
        .targetEvent(ev))
      .then(function(){
        DigestModel
          .deleteById({id: digest.id}, function(){
            deferred.resolve();
          });
      });

    return deferred.promise;
  };

  this.find = function(id){
    var deferred = $q.defer();

    DigestModel.find({
      filter: {
        where: {
          id: id
        }
      }
    }, function(digests){
      digests = angular.copy(digests);
      digests = (digests.length)? digests[0] : {};
      deferred.resolve(digests);
    });

    return deferred.promise;
  }

  return this;
});
