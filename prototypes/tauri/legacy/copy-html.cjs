const fs = require('fs')
const path = require('path')
fs.writeFileSync(path.join(__dirname, '../dist/index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lepton Local Prototype</title></head><body><div id="container"></div><script src="./error-handler.js"></script><script src="./app.bundle.js"></script></body></html>')

fs.copyFileSync(path.join(__dirname, 'error-handler.js'), path.join(__dirname, '../dist/error-handler.js'))
