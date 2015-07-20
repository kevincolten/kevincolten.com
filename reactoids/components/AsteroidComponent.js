var React = require('react');
var Backbone = require('backbone');
require('react.backbone');

module.exports = React.createBackboneClass({

  render: function() {
    var divStyle = {
      backgroundColor: 'black',
      left: this.props.model.get('pos_x'),
      top: this.props.model.get('pos_y'),
      position: 'absolute',
      height: this.props.model.get('radius') * 2 + 'px',
      width: this.props.model.get('radius') * 2 + 'px',
      borderRadius: this.props.model.get('radius') + 'px'
    };

    return (
      <div style={divStyle}></div>
    );
  }
});
