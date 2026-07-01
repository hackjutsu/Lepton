const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '../..')
const distRoot = path.join(repoRoot, 'dist')

function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getFreePort () {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function createTempHome (locale = 'en') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-packaged-smoke-'))
  const configHome = path.join(root, 'config')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(configHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(path.join(configHome, '.leptonrc'), JSON.stringify({
    autoUpdate: false,
    i18n: {
      locale
    },
    logger: {
      level: 'error'
    }
  }))
  return { configHome, root, userData }
}

const PACKAGED_RENDER_FIXTURES = [
  {
    name: 'dashboard',
    selector: '.dashboard-modal canvas',
    text: 'Dashboard'
  },
  {
    name: 'jupyter-notebook',
    selector: '.jupyterNotebook-section .nb-notebook',
    text: 'Notebook Fixture|hello from notebook|42'
  }
]

function waitForProcessExit (child, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve()
      return
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Timed out waiting for packaged app process to exit.'))
    }, timeout)

    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

function findPackagedApp () {
  if (process.platform !== 'darwin') {
    throw new Error('Packaged app smoke test currently expects a macOS .app bundle.')
  }

  const appCandidates = fs.readdirSync(distRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('mac'))
    .flatMap(entry => {
      const appDir = path.join(distRoot, entry.name)
      return fs.readdirSync(appDir, { withFileTypes: true })
        .filter(appEntry => appEntry.isDirectory() && appEntry.name.endsWith('.app'))
        .map(appEntry => path.join(appDir, appEntry.name))
    })

  if (appCandidates.length === 0) {
    throw new Error('Missing packaged macOS app. Run `npm run pack` before the packaged smoke test.')
  }

  return appCandidates[0]
}

function getExecutablePath (appPath) {
  const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist')
  const result = spawnSync('plutil', ['-extract', 'CFBundleExecutable', 'raw', infoPlistPath], {
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw new Error(`Failed to read packaged app executable from Info.plist.\n${result.stderr}`)
  }

  return path.join(appPath, 'Contents', 'MacOS', result.stdout.trim())
}

function runCodesignDiagnostics (appPath) {
  const result = spawnSync('codesign', ['--verify', '--deep', '--strict', '--verbose=4', appPath], {
    encoding: 'utf8'
  })

  if (result.status === 0) {
    console.log('Packaged app strict codesign verification passed')
    return
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  const message = [
    'Packaged app strict codesign verification did not pass.',
    'This is expected on unsigned local builds without a Developer ID identity.',
    output
  ].join('\n')

  if (process.env.LEPTON_PACKAGED_SMOKE_REQUIRE_CODESIGN === '1') {
    throw new Error(message)
  }

  console.warn(message)
}

async function fetchJson (url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function waitForDebugTarget (port) {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`)
      const pageTarget = targets.find(target =>
        target.type === 'page' && target.webSocketDebuggerUrl
      )
      if (pageTarget) return pageTarget
    } catch (err) {
      // The app may still be starting its debugging endpoint.
    }
    await wait(100)
  }

  throw new Error('Timed out waiting for the packaged app debugging target.')
}

function connectCdp (webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl)
    let nextId = 1
    const pending = new Map()

    socket.addEventListener('open', () => {
      resolve({
        call (method, params = {}) {
          const id = nextId++
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject })
          })
        },
        close () {
          socket.close()
        }
      })
    })

    socket.addEventListener('message', event => {
      const payload = JSON.parse(event.data)
      if (!payload.id || !pending.has(payload.id)) return

      const request = pending.get(payload.id)
      pending.delete(payload.id)

      if (payload.error) {
        request.reject(new Error(`${payload.error.message}: ${payload.error.data || ''}`))
        return
      }

      request.resolve(payload.result)
    })

    socket.addEventListener('error', reject)
  })
}

async function waitForLoginUi (cdp, expectedText) {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const result = await cdp.call('Runtime.evaluate', {
      expression: `
        (() => {
          const appContainer = document.querySelector('.app-container')
          const loginModal = document.querySelector('.login-modal')
          const appBounds = appContainer ? appContainer.getBoundingClientRect() : null
          const languageSelector = document.querySelector('[data-role="language-selector"]')
          return {
            bodyText: document.body ? document.body.innerText : '',
            hasAppContainer: Boolean(appContainer),
            hasLoginModal: Boolean(loginModal),
            hasLeptonBridge: Boolean(window.lepton),
            hasLeptonConfigBridge: Boolean(window.lepton && window.lepton.config && window.lepton.config.get),
            processType: typeof process,
            requireType: typeof require,
            languageOptions: languageSelector
              ? Array.from(languageSelector.options).map(option => option.value)
              : [],
            appBounds: appBounds ? {
              width: appBounds.width,
              height: appBounds.height
            } : null
          }
        })()
      `,
      returnByValue: true
    })
    const state = result.result.value
    const expectedTexts = expectedText.split('|')

    if (
      state.hasAppContainer &&
      state.hasLoginModal &&
      state.hasLeptonBridge &&
      state.hasLeptonConfigBridge &&
      state.requireType === 'undefined' &&
      state.processType === 'undefined' &&
      state.appBounds &&
      state.appBounds.width > 0 &&
      state.appBounds.height > 0 &&
      expectedTexts.every(text => state.bodyText.includes(text)) &&
      ['en', 'es', 'fr', 'ja', 'ko', 'zh-Hans', 'zh-Hant'].every(locale => state.languageOptions.includes(locale))
    ) {
      return state
    }

    await wait(100)
  }

  throw new Error('Timed out waiting for the packaged login UI to render.')
}

async function waitForFixtureUi (cdp, expectedSelector, expectedText) {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const result = await cdp.call('Runtime.evaluate', {
      expression: `
        (() => {
          const expectedNode = document.querySelector(${JSON.stringify(expectedSelector)})
          const bounds = expectedNode ? expectedNode.getBoundingClientRect() : null
          const appContainer = document.querySelector('.app-container')
          return {
            bodyText: document.body ? document.body.innerText : '',
            hasAppContainer: Boolean(appContainer),
            hasExpectedNode: Boolean(expectedNode),
            hasLeptonBridge: Boolean(window.lepton),
            hasLeptonConfigBridge: Boolean(window.lepton && window.lepton.config && window.lepton.config.get),
            processType: typeof process,
            requireType: typeof require,
            expectedBounds: bounds ? {
              width: bounds.width,
              height: bounds.height
            } : null
          }
        })()
      `,
      returnByValue: true
    })
    const state = result.result.value
    const expectedTexts = expectedText.split('|').filter(Boolean)

    if (
      state.hasAppContainer &&
      state.hasExpectedNode &&
      state.hasLeptonBridge &&
      state.hasLeptonConfigBridge &&
      state.requireType === 'undefined' &&
      state.processType === 'undefined' &&
      state.expectedBounds &&
      state.expectedBounds.width > 0 &&
      state.expectedBounds.height > 0 &&
      expectedTexts.every(text => state.bodyText.includes(text))
    ) {
      return state
    }

    await wait(100)
  }

  throw new Error(`Timed out waiting for packaged fixture selector "${expectedSelector}" to render.`)
}

async function captureScreenshot (cdp, artifactDir, fileName) {
  await cdp.call('Runtime.evaluate', {
    expression: 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    awaitPromise: true
  })
  await wait(250)
  const result = await cdp.call('Page.captureScreenshot', { format: 'png' })
  const screenshotPath = path.join(artifactDir, fileName)
  fs.writeFileSync(screenshotPath, Buffer.from(result.data, 'base64'))
  console.log(`Saved packaged smoke-test screenshot to ${screenshotPath}`)
}

async function runPackagedScenario (appPath, options) {
  const executablePath = getExecutablePath(appPath)
  const tempHome = createTempHome('en')
  const port = await getFreePort()

  const child = spawn(executablePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempHome.userData}`
  ], {
    cwd: repoRoot,
    env: Object.assign({}, process.env, options.renderFixture ? {
      LEPTON_RENDER_FIXTURE: options.renderFixture
    } : {}, {
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      XDG_CONFIG_HOME: tempHome.configHome
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  child.stdout.on('data', data => {
    const text = data.toString()
    output += text
    process.stdout.write(text)
  })
  child.stderr.on('data', data => {
    const text = data.toString()
    output += text
    process.stderr.write(text)
  })

  let cdp
  try {
    const target = await waitForDebugTarget(port)
    cdp = await connectCdp(target.webSocketDebuggerUrl)
    await cdp.call('Page.enable')
    await cdp.call('Runtime.enable')
    if (options.renderFixture) {
      await waitForFixtureUi(cdp, options.expectedSelector, options.expectedText)
    } else {
      await waitForLoginUi(cdp, options.expectedText)
    }
    await captureScreenshot(cdp, tempHome.root, options.screenshotName)
    cdp.call('Browser.close').catch(() => {})
  } catch (err) {
    if (cdp) cdp.close()
    child.kill('SIGKILL')
    throw new Error(`${err.message}\nPackaged app output:\n${output}`)
  } finally {
    if (cdp) cdp.close()
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM')
      await waitForProcessExit(child).catch(() => {})
    }
  }
}

async function runPackagedSmoke () {
  const appPath = findPackagedApp()
  runCodesignDiagnostics(appPath)

  await runPackagedScenario(appPath, {
    expectedText: 'Login|GitHub Login',
    screenshotName: 'electron-packaged-smoke-success.png'
  })

  for (const fixture of PACKAGED_RENDER_FIXTURES) {
    await runPackagedScenario(appPath, {
      expectedSelector: fixture.selector,
      expectedText: fixture.text,
      renderFixture: fixture.name,
      screenshotName: `electron-packaged-${fixture.name}-success.png`
    })
  }

  console.log('electron packaged smoke test passed')
}

runPackagedSmoke().catch(err => {
  console.error(err)
  process.exit(1)
})
