'use strict'

const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  entry: [
    './app/index.js'
  ],
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'bundle'),
    publicPath: '/bundle/',
    filename: 'app.bundle.js'
  },
  module: {
    rules: [{
      test: /\.js$/,
      include: [path.resolve(__dirname, 'app')],
      exclude: /node_modules/,
      loader: 'babel-loader',
      options: {
        presets: [
          ['es2015',  { "modules": false }],
          'react'
        ]
      }
    }, {
      test: /\.(scss|css)$/,
      loaders: ['style-loader', 'css-loader', 'sass-loader']
    }, {
      test: /\.(png|jpg)$/,
      loader: 'url-loader'
    }, {
      test: /\.html$/,
      loader: 'html-loader'
    }, {
      test: /\.txt$/,
      loader: 'text-loader'
    }, {
      test: /\.(woff|woff2)(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'url-loader?limit=10000&mimetype=application/font-woff'
    }, {
      test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'url-loader?limit=10000&mimetype=application/octet-stream'
    }, {
      test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'file-loader'
    }, {
      test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'raw-loader'
    }]
  },
  externals: [nodeExternals({
    // this WILL include `jquery` and `webpack/hot/dev-server` in the bundle, as well as `lodash/*`
    // whitelist: ['jquery', 'webpack/hot/dev-server', /^lodash/]
  })]
}
