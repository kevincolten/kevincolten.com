require('backbone')
var React = require('react');
require('react.backbone');

module.exports = React.createBackboneClass({
  render: function () {
    return (
      <div className="row">
        <div className="twelve columns">
            <h5>
              <a href={ "#posts/" + this.props.model.id}>{this.props.model.get('description')}</a>
            </h5>
        </div>
      </div>
    );
  }
});
