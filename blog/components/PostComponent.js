var React = require('react');
var Backbone = require('backbone');
require('react.backbone');
var moment = require('moment');

module.exports = React.createBackboneClass({
  render: function() {
    return (
      <div className="container">
        <div className="row">
            <div className="twelve columns">
              <h3>{this.props.model.get('description')}</h3>
              <h6>{ moment(this.props.model.get('created_at')).format("MMM Do, YYYY") }</h6>
            </div>
        </div>
        <div className="row">
            <div className="twelve columns">
                <div dangerouslySetInnerHTML={{__html: this.props.model.get('content')}}></div>
            </div>
        </div>
      </div>
    );
  }
});
