// Run after npm run webpack-prod: node node_modules/electron/cli.js tests/performance/electron-flow.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')
const { app, BrowserWindow } = require('electron')
const physicalFootprint = require('./physicalFootprint.cjs')

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-performance-'))
process.env.XDG_CONFIG_HOME = profileDir
process.env.LEPTON_RENDER_FIXTURE = 'memory-flow'
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
    const run = expression => window.webContents.executeJavaScript(expression, true)
    await run(`(async () => {
      const deadline = Date.now() + 30000;
      const isReady = () => document.querySelectorAll('.snippet-thumnail-list-item').length === 100 && document.querySelector('.code-table');
      while (!isReady() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      if (!isReady()) throw Error('Browsing fixture did not render');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`)
    const startupMs = performance.now() - started
    window.webContents.debugger.attach('1.3')
    await window.webContents.debugger.sendCommand('Performance.enable')
    const memory = async () => {
      await window.webContents.debugger.sendCommand('HeapProfiler.collectGarbage')
      await wait(150)
      const metrics = app.getAppMetrics()
      const processes = metrics.map(metric => ({
        type: metric.type,
        serviceName: metric.serviceName,
        workingSetKiB: metric.memory.workingSetSize
      }))
      // Working sets include shared pages; their sum is not unique physical memory.
      return {
        processes,
        physicalFootprintBytes: physicalFootprint(metrics),
        sumWorkingSetKiB: processes.reduce((total, metric) => total + metric.workingSetKiB, 0)
      }
    }
    const initialMemory = await memory()
    const firstUse = await run(`(async () => {
      const poll = async (condition, message) => {
        const deadline = performance.now() + 10000;
        while (!condition() && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1));
        if (!condition()) throw Error(message);
      };
      const click = index => document.querySelectorAll('.snippet-thumnail-list-item > div')[index].click();
      const start = performance.now();
      click(1);
      await poll(() => document.querySelector('.markdown-section h1')?.textContent === 'Profile Markdown', 'Markdown did not render');
      const markdownMs = performance.now() - start;
      click(0);
      await poll(() => document.querySelector('.code-table')?.textContent.includes('const value0 = 0;'), 'Snippet did not render');
      const editStart = performance.now();
      document.querySelector('.snippet-control[title="Edit"]').click();
      await poll(() => document.querySelector('.edit-modal .CodeMirror'), 'Editor did not render');
      const cm = document.querySelector('.edit-modal .CodeMirror').CodeMirror;
      await poll(() => cm.getMode().name === 'javascript', 'JavaScript mode did not load');
      const editorMs = performance.now() - editStart;
      const input = document.querySelector('.gist-editor-filename-area');
      const modeStart = performance.now();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'component.vue');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await poll(() => cm.getMode().name === 'vue', 'Vue mode did not load');
      const vueMs = performance.now() - modeStart;
      const typing = [];
      for (let index = 0; index < 12; index++) {
        const typingStart = performance.now();
        cm.replaceRange('a', cm.getCursor());
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        typing.push(performance.now() - typingStart);
      }
      return { markdownMs, editorMs, vueMs, typing };
    })()`)
    const afterMemory = await memory()
    await run("document.querySelector('.edit-modal .close').click()")
    await wait(200)
    const closedMemory = await memory()
    const startMetrics = await window.webContents.debugger.sendCommand('Performance.getMetrics')
    const switching = await run(`(async () => {
      const times = [];
      for (let index = 2; index < 14; index++) {
        const start = performance.now();
        document.querySelectorAll('.snippet-thumnail-list-item > div')[index].click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!document.querySelector('.code-table').textContent.includes('const value0 = ' + index + ';')) {
          throw Error('Wrong snippet after selection');
        }
        times.push(performance.now() - start);
      }
      return times;
    })()`)
    const endMetrics = await window.webContents.debugger.sendCommand('Performance.getMetrics')
    const metricDelta = name => {
      const before = startMetrics.metrics.find(metric => metric.name === name).value
      const after = endMetrics.metrics.find(metric => metric.name === name).value
      return (after - before) * 1000
    }
    console.log('PROFILE=' + JSON.stringify({
      startupMs, initialMemory, firstUse, afterMemory, closedMemory, switching,
      switchScriptMs: metricDelta('ScriptDuration'),
      switchTaskMs: metricDelta('TaskDuration')
    }))
    app.exit(0)
  } catch (error) {
    console.error(error)
    app.exit(1)
  }
})
