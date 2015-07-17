var Backbone = require('backbone');
var React = require('react');
require('backbone.controller');
var PostComponent = require('../components/PostComponent');
var PostsListComponent = require('../components/PostsListComponent');
var PostsCollection = require('../collections/PostsCollection');
var PostModel = require('../models/PostModel');

module.exports = Backbone.Controller.extend({
  routes: {
    '': 'index',
    '/': 'index',
    'posts/:id': 'show',
    'posts': 'index',
  },

  initialize: function() {
    this.collection = new PostsCollection();
  },

  index: function() {
    this.collection.fetch();
    var PostsListView = React.createFactory(PostsListComponent);
    React.render(PostsListView({ collection: this.collection }), document.getElementById('content'));
  },

  show: function(id) {
    var post = this.collection.get(id);
    if (!post) {
      post = new PostModel({ id: id });
    }
    post.fetch();
    var PostView = React.createFactory(PostComponent);
    React.render(PostView({ model: post }), document.getElementById('content'));
  }
});
