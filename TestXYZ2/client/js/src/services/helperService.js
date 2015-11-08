app.service('helper', function ($filter) {
  'use strict';
  var exports = {};

  exports.isDisplay = function(type){
    return (type === 'display');
  };

  exports.renderDateColumn = function (data, type) {
    return exports.isDisplay(type)? $filter('date', 'short')(data) : '';
  };

  exports.renderLinkColumn = function (data, type, full) {
    if(exports.isDisplay(type)){
      return angular.sprintf('<a href="#/posts/%(id)s" data-id="%(id)s">%(title)s</a>', {
        id: full.id,
        title: full.title
      });
    }
    return '';
  };

  exports.isArrayEqual = function(a, b) {
    return _.all(_.zip(a, b), function(x) {
      return x[0] === x[1];
    });
  };

  return exports;
});
