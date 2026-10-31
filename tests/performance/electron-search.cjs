// Run after npm run webpack-prod: node node_modules/electron/cli.js tests/performance/electron-search.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')
const { app, BrowserWindow } = require('electron')
const physicalFootprint = require('./physicalFootprint.cjs')

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-performance-'))
process.env.XDG_CONFIG_HOME = profileDir
process.env.LEPTON_RENDER_FIXTURE = 'memory-search'
fs.writeFileSync(path.join(profileDir, '.leptonrc'), JSON.stringify({ autoUpdate: false, logger: { level: 'error' } }))
app.setPath('userData', path.join(profileDir, 'user-data'))
process.on('exit', () => {
  try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch (_) {}
})

const repo = path.resolve(process.env.LEPTON_PROFILE_REPO || path.join(__dirname, '../..'))
const started = performance.now()
app.getAppPath = () => repo
require(path.join(repo, 'main.js'))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.whenReady().then(async () => {
  try {
    while (!BrowserWindow.getAllWindows().length) await wait(10)
    const window = BrowserWindow.getAllWindows()[0]
    if (window.webContents.isLoading()) {
      await new Promise(resolve => window.webContents.once('did-finish-load', resolve))
    }
    const ui = await window.webContents.executeJavaScript(`(async () => {
      const deadline = Date.now() + 30000;
      while (document.querySelectorAll('.result-group > li').length !== 1000 && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const rows = document.querySelectorAll('.result-group > li').length;
      if (rows !== 1000) throw Error('Expected 1000 search results, got ' + rows);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        rows,
        count: document.querySelector('.search-result-count').textContent,
        match: document.querySelector('.search-match-excerpt').textContent
      };
    })()`)
    const readyMs = performance.now() - started
    await wait(500)
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('HeapProfiler.collectGarbage')
    await wait(150)
    const heap = await window.webContents.debugger.sendCommand('Runtime.getHeapUsage')
    const dom = await window.webContents.debugger.sendCommand('Memory.getDOMCounters')
    const metrics = app.getAppMetrics()
    const processes = metrics.map(metric => ({
      type: metric.type,
      serviceName: metric.serviceName,
      workingSetKiB: metric.memory.workingSetSize
    }))
    const physicalFootprintBytes = physicalFootprint(metrics)
    const queryMs = await window.webContents.executeJavaScript(`(async () => {
      const input = document.querySelector('.search-box');
      const start = performance.now();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'const value0');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: '0', keyCode: 48 }));
      const deadline = Date.now() + 30000;
      const isUpdated = () => Array.from(document.querySelectorAll('.search-match-excerpt .search-match-highlight'))
        .some(node => node.textContent === 'value0');
      while (!isUpdated() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 2));
      if (!isUpdated()) throw Error('Updated search did not render');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return performance.now() - start;
    })()`)
    console.log('PROFILE=' + JSON.stringify({
      readyMs,
      queryMs,
      ui,
      heapBytes: heap.usedSize,
      domNodes: dom.nodes,
      processes,
      physicalFootprintBytes,
      // Working sets include shared pages; their sum is not unique physical memory.
      sumWorkingSetKiB: processes.reduce((total, metric) => total + metric.workingSetKiB, 0)
    }))
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
