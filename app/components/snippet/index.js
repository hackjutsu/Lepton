import React, { Component } from 'react';
import './index.scss';

class Snippet extends Component {
  render() {
    return (
      <div className='snippet-box'>
        <div className='snippet-code'>
          <p>{this.props.html_url}</p>
        </div>
      </div>
    )
  }
};

export default Snippet;
