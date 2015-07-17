var Backbone = require('backbone');
var _ = require('underscore');
var PostModel = require('../models/PostModel');

module.exports = Backbone.Collection.extend({
  url: 'https://api.github.com/users/mistakevin/gists',
  model: PostModel,

  parse: function(collection)
  {
    collection = _.filter(collection, function (model) {
      return model.description.indexOf('@post ') > -1;
    });

    return collection;
  }
});
