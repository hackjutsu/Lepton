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
			test: /\.json/,
			// exclude: /node_modules/,
			loaders: ['json']
		}]
	},
	target: 'electron'
};
