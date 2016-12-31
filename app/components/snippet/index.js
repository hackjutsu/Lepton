import React, { Component } from 'react'
import ReqPromise from 'request-promise'
import Account from '../../../configs/account'
import './index.scss'

const single_gist_uri = 'https://api.github.com/gists/'

function makeOption(uri) {
    return {
        uri: uri,
        headers: {
            'User-Agent': 'Request-Promise'
        },
        auth: { // HTTP Authentication
            user: Account.username,
            pass: Account.password
        },
        json: true // Automatically parses the JSON string in the response
    }
}

class Snippet extends Component {

  constructor(props){
    super(props)

    let snippet = this.props.snippet
    this.state = Object.assign({}, snippet)

    if (!this.state.details) {
        this.fetchSnippet()
    }
  }

  fetchSnippet() {
    // console.log(single_gist_uri + this.state.id)
    ReqPromise(makeOption(single_gist_uri + this.state.brief.id))
      .then((details) => {
        //  console.log(details.description)
         this.setState({
             details: details
         })
         this.props.updateGistStore(
             Object.assign({}, this.state)
         )
      })
      .catch(function (err) {
        console.log('The request has failed: ' + err)
      })
  }

  render() {

    if (!this.state.details) {
        return (
          <div className='snippet-box'>
            <div className='snippet-code'>
              <p>'Loading...'</p>
            </div>
          </div>
        )
    }

    let files = []
    let fileList = this.state.details.files
    for (let key in fileList) {
      if (fileList.hasOwnProperty(key)) {
        let gistFile = fileList[key]
        files.push(
          <div key={ key }>
            <div>{ gistFile.filename }</div>
            <div>{ gistFile.language }</div>
            <div className='code-area'>
                <code>{ gistFile.content }</code>
            </div>
          </div>
        )
      }
    }

    return (
      <div className='snippet-box'>
        <div className='snippet-code'>
          <a href={ this.state.details.html_url }>{ this.state.details.description }</a>
          { files }
        </div>
      </div>
    )
  }
}

export default Snippet
