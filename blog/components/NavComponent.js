require('backbone')
var React = require('react');
require('react.backbone');

module.exports = React.createBackboneClass({
  mixins: [],

  render: function() {
    return (
      <div className="container">
        <div className="row">
          <div className="two columns">
            <h5><a href="/">Home</a></h5>
          </div>
          <div className="two columns">
            <h5><a href="#posts">Posts</a></h5>
          </div>
        </div>
      </div>
    );
  }
});
