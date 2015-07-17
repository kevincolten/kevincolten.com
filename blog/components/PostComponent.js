var React = require('react');
var Backbone = require('backbone');
require('react.backbone');

module.exports = React.createBackboneClass({
  render: function() {
    return (
      <div className="container">
        <div className="row">
            <div className="twelve columns">
                <h3>{this.props.model.get('description')}</h3>
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
