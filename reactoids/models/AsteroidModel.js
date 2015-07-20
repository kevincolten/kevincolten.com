var MovingObjectModel = require('./MovingObjectModel');
var _ = require('underscore')

module.exports = MovingObjectModel.extend({

    initialize: function()
    {
        this.set({
            radius: _.random(5, 30),
            vel_x: _.random(-3, 3),
            vel_y: _.random(-3, 3),
            pos_x: _.random(0, window.innerWidth),
            pos_y: _.random(0, window.innerHeight)
        }, {
            silent: true
        });
    }
});