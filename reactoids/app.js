'use strict';

var AsteroidModel = require('./models/AsteroidModel');
var AsteroidComponent = require('./components/AsteroidComponent');
var Backbone = require('backbone');
var React = require('react');
var _ = require('underscore');
var $ = require('jquery');

var Application = Backbone.Router.extend({
  initialize: function()
  {
    var asteroids = new Backbone.Collection();

    _(50).times(function (idx) {
      asteroids.add(new AsteroidModel({ id: idx }));
    });

    asteroids.each(function (asteroid) {
      var AsteroidView = React.createFactory(AsteroidComponent);
      $('body').prepend('<div id="asteroid' + asteroid.id + '">');
      React.render(AsteroidView({ model: asteroid }), $('#asteroid' + asteroid.id)[0]);
    });

    setInterval (function () {
      asteroids.each(function (asteroid) {
        asteroid.set({
          pos_x: asteroid.get('pos_x') + asteroid.get('vel_x'),
          pos_y: asteroid.get('pos_y') + asteroid.get('vel_y'),
        });
        if (asteroid.offScreen()) {
          asteroid.fixOffScreen();
        }
      });
    }, 10);

  }
});

window.app = new Application();
