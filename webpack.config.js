'use strict'

const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')


module.exports = {
    entry: [
        './app/index.js'
    ],
    target: 'electron',
    output: {
        path: path.resolve(__dirname, 'bundle'),
        publicPath: '/bundle/',
        filename: 'app.bundle.js'
    },
    watch: true,
	module: {
		loaders: [{
          test: /\.js$/,
          include: [path.resolve(__dirname, 'app')],
          exclude: /node_modules/,
          loaders: ['babel?presets[]=es2015,presets[]=react']
        }, {
          test: /\.(scss|css)$/,
          loaders: ['style', 'css', 'sass']
        }, {
			test: /\.json/,
			// exclude: /node_modules/,
			loader: 'json'
		}, {
          test: /\.(png|jpg)$/,
          loader: 'url-loader'
        }, {
          test: /\.html$/,
          loader: 'html'
        }, {
          test: /\.txt$/,
          loader: 'text'
        }]
	},
    externals: [nodeExternals({
        // this WILL include `jquery` and `webpack/hot/dev-server` in the bundle, as well as `lodash/*`
        // whitelist: ['jquery', 'webpack/hot/dev-server', /^lodash/]
    })]
}
