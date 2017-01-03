'use strict'

const Account = require('./configs/account')
const electron = require('electron')
const ReqPromise = require('request-promise')

const app = electron.app
const BrowserWindow = electron.BrowserWindow

let mainWindow = null
let authWindow = null
let self = this
let accessToken = null

let options = {
  client_id: Account.client_id,
  client_secret: Account.client_secret,
  scopes: ['user', 'gist']
}

app.on('ready', () => {

  mainWindow = new BrowserWindow({ width: 800, height: 600, show: false })

  // Build the OAuth consent page URL
  let authWindow = new BrowserWindow({ width: 800, height: 600, show: false })
  let githubUrl = 'https://github.com/login/oauth/authorize?'
  let authUrl = githubUrl + 'client_id=' + options.client_id + '&scope=' + options.scopes
  authWindow.loadURL(authUrl)
  authWindow.show()

  function handleCallback (url) {
    let raw_code = /code=([^&]*)/.exec(url) || null
    let code = (raw_code && raw_code.length > 1) ? raw_code[1] : null
    let error = /\?error=(.+)$/.exec(url)

    if (code || error) {
      // Close the browser if code found or error
      console.log('** About to destroy the auth browser')
      authWindow.destroy()
    }

    // If there is a code, proceed to get token from github
    if (code) {
      console.log(code)
      let accessTokenPromise = requestGithubToken(options, code)
      accessTokenPromise.then((response) => {
          accessToken = response.access_token
          console.log('Got access Token')
          console.log(accessToken)

          mainWindow.loadURL(`file://${__dirname}/index.html?access_token=${ accessToken }`)
          mainWindow.show()
          mainWindow.webContents.openDevTools()
        //   authWindow.destroy()
        }).catch((err) => {
          console.log('Failed: ' + JSON.stringify(err.error))
        })
    } else if (error) {
      alert('Oops! Something went wrong and we couldn\'t' +
        'log you in using Github. Please try again.')
    }
  }

  function requestGithubToken (options, code) {
    return ReqPromise({
        method: 'POST',
        uri: 'https://github.com/login/oauth/access_token',
        form: {
          'client_id': options.client_id,
          'client_secret': options.client_secret,
          'code': code,
        },
        json: true
    })
  }

  // Handle the response from GitHub - See Update from 4/12/2015
  authWindow.webContents.on('will-navigate', function (event, url) {
    console.log('** Inside on will-navigate')
    handleCallback(url)
  })

  authWindow.webContents.on('did-get-redirect-request', function (event, oldUrl, newUrl) {
    console.log('** Inside did-get-redirect-request')
    handleCallback(newUrl)
  })

  // Reset the authWindow on close
  authWindow.on('close', function () {
    authWindow = null
  }, false)
})
