'use strict'

const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: [
        './app/app.js'
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'app.bundle.js'
    },
	module: {
		loaders: [{
          test: /\.js$/,
          include: [path.resolve(__dirname, 'app')],
          exclude: /node_modules/,
          loaders: ['babel?presets[]=es2015,presets[]=react']
        }, {
          test: /\.scss$/,
          exclude: /node_modules/,
          loaders: ['style', 'css', 'sass']
        }, {
			test: /\.json/,
			// exclude: /node_modules/,
			loaders: ['json']
		}]
	},
	target: 'electron'
};
