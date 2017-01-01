'use strict'

const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const config = require('./webpack.config')

new WebpackDevServer(webpack(config), {
  publicPath: config.output.publicPath,
  inline: true,
  hot: true,
  noInfo: false,
  colors: true,
  historyApiFallback: true,
  // proxy: {
  //   '*': 'http://127.0.0.1:3000'
  // }
}).listen(3000, '127.0.0.1', (err, result) => {
  if (err) return console.log(err)
  console.log('Listening at 127.0.0.1:3000')
})
