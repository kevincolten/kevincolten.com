require('backbone')
var React = require('react');
require('react.backbone');
var moment = require('moment');

module.exports = React.createBackboneClass({
  render: function () {
    return (
      <div className="row">
        <div className="twelve columns">
            <h6>{ moment(this.props.model.get('created_at')).format("MMM Do, YYYY") }</h6>
            <h5>
              <a href={ "#posts/" + this.props.model.id}>{this.props.model.get('description')}</a>
            </h5>
        </div>
      </div>
    );
  }
});
