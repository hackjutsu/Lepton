const path = require('path')
const root = path.resolve(__dirname, '../..')
const base = require(path.join(root, 'webpack.config.js'))
base.entry = path.join(__dirname, 'legacy/entry.js')
base.output = { path: path.join(__dirname, 'dist'), publicPath: './', filename: 'app.bundle.js', clean: true }
base.resolve.alias.jsdom = false
// Keep the Electron components unchanged while placing Tauri editors in the detail pane.
base.resolve.alias['../snippet$'] = path.join(__dirname, 'legacy/inlineSnippet.js')
base.resolve.alias['../userPanel$'] = path.join(__dirname, 'legacy/inlineUserPanel.js')
base.resolve.alias['react$'] = require.resolve('react', { paths: [root] })
base.resolve.alias['react-dom$'] = require.resolve('react-dom', { paths: [root] })
base.module.rules.find(rule => String(rule.test) === String(/\.js$/)).include.push(path.join(__dirname, 'legacy'))
base.module.rules.push({ test: /notebookjs[\\/]notebook\.js$/, use: path.join(__dirname, 'legacy/notebook-browser-loader.cjs') })
base.module.rules.push({ test: /\.m?js$/, resolve: { fullySpecified: false } })
base.resolve.modules = [path.join(root, 'node_modules'), path.join(__dirname, 'node_modules'), 'node_modules']
module.exports = base
