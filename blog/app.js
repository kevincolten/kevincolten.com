'use strict';

var Backbone = require('backbone');
var PostsController = require('./controllers/PostsController');

var Application = Backbone.Router.extend({
  controllers: {},

  initialize: function() {
    this.controllers.posts = new PostsController({router: this});
    Backbone.history.start();
  }
});

window.app = new Application();
