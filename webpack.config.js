

const path = require('path')
const webpack = require('webpack')

module.exports = {
  entry: [
    './app/index.js'
  ],
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'bundle'),
    publicPath: '/bundle/',
    filename: 'app.bundle.js'
  },
  resolve: {
    alias: {
      'punycode$': require.resolve('punycode/'),
      'react/jsx-runtime': require.resolve('react/jsx-runtime')
    }
  },
  module: {
    rules: [{
      test: /highlightjs-solidity[\\/]solidity\.js$/,
      loader: path.resolve(__dirname, 'configs/loaders/stripSolidityModuleShim.js')
    }, {
      test: /\.js$/,
      include: [path.resolve(__dirname, 'app')],
      exclude: /node_modules/,
      loader: 'babel-loader',
      options: {
        presets: [
          ['@babel/preset-env', { modules: false }],
          '@babel/preset-react'
        ]
      }
    }, {
      test: /\.(scss|css)$/,
      use: [
        'style-loader',
        'css-loader',
        {
          loader: 'sass-loader',
          options: {
            implementation: require('sass'),
            api: 'modern'
          }
        }
      ]
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
      loader: 'url-loader',
      options: {
        limit: 10000,
        mimetype: 'application/font-woff'
      }
    }, {
      test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'url-loader',
      options: {
        limit: 10000,
        mimetype: 'application/octet-stream'
      }
    }, {
      test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'file-loader'
    }, {
      test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
      loader: 'raw-loader'
    }, {
      test: /\.all-contributorsrc$/,
      loader: 'json-loader'
    }]
  }
}
