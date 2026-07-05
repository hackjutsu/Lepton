const fs = require('fs')
const path = require('path')
const { app, BrowserWindow } = require('electron')

const repoRoot = path.resolve(__dirname, '../..')
const scenario = process.env.LEPTON_LOGIN_FLOW_SCENARIO
const artifactDir = process.env.LEPTON_LOGIN_FLOW_ARTIFACT_DIR
const loginModalFlipSettleMs = 700
const invalidTokenMessage = 'Token invalid. Please try again.'

app.getAppPath = () => repoRoot

require(path.join(repoRoot, 'main.js'))

const rendererEvents = []

function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForMainWindow () {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const window = BrowserWindow.getAllWindows()
      .find(candidate => candidate && !candidate.isDestroyed() && !candidate.getParentWindow())
    if (window) return window
    await wait(100)
  }

  throw new Error('Timed out waiting for the main Electron window.')
}

async function waitForRendererLoad (window) {
  if (!window.webContents.isLoading()) return

  await Promise.race([
    new Promise(resolve => window.webContents.once('did-finish-load', resolve)),
    wait(30000)
  ])
}

function attachRendererDiagnostics (window) {
  window.webContents.on('console-message', function (event) {
    const details = typeof event.message !== 'undefined'
      ? event
      : {
          level: arguments[1],
          lineNumber: arguments[3],
          message: arguments[2],
          sourceId: arguments[4]
        }
    rendererEvents.push(`console:${details.level}:${details.sourceId}:${details.lineNumber}: ${details.message}`)
  })
  window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    rendererEvents.push(`did-fail-load:${errorCode}:${validatedURL}: ${errorDescription}`)
  })
  window.webContents.on('render-process-gone', (event, details) => {
    rendererEvents.push(`render-process-gone: ${JSON.stringify(details)}`)
  })
  window.webContents.on('crashed', () => {
    rendererEvents.push('renderer crashed')
  })
}

async function waitForCondition (window, expression, description, timeoutMs = 30000) {
  const found = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const deadline = Date.now() + ${timeoutMs}
      function check() {
        if (${expression}) {
          resolve(true)
          return
        }
        if (Date.now() > deadline) {
          resolve(false)
          return
        }
        setTimeout(check, 100)
      }
      check()
    })
  `, true)

  if (found) return

  const state = await getRendererState(window)
  throw new Error([
    `Timed out waiting for ${description}.`,
    `Renderer state: ${JSON.stringify(state)}`,
    `Renderer events: ${rendererEvents.join('\n') || '(none)'}`
  ].join('\n'))
}

async function getRendererState (window) {
  return window.webContents.executeJavaScript(`
    (() => {
      const loginModal = document.querySelector('.login-modal')
      const activeLayout = document.querySelector('.active-layout')
      const loginStatus = document.querySelector('.login-status-line')
      const tokenInput = document.querySelector('.login-modal input.form-control')
      const buttons = Array.from(document.querySelectorAll('button')).map(button => ({
        disabled: button.disabled,
        text: button.innerText.trim()
      }))

      return {
        bodyText: document.body ? document.body.innerText : '',
        hasActiveLayout: Boolean(activeLayout),
        hasLoginModal: Boolean(loginModal),
        hasTokenInput: Boolean(tokenInput),
        location: window.location ? window.location.href : '',
        loginStatus: loginStatus ? loginStatus.innerText : '',
        buttons
      }
    })()
  `, true)
}

async function clickButton (window, text) {
  const result = await window.webContents.executeJavaScript(`
    (() => {
      const button = Array.from(document.querySelectorAll('button'))
        .find(candidate => candidate.innerText.trim() === ${JSON.stringify(text)})
      if (!button) {
        return {
          clicked: false,
          reason: 'missing-button',
          bodyText: document.body ? document.body.innerText : ''
        }
      }
      if (button.disabled) {
        return {
          clicked: false,
          reason: 'disabled-button',
          bodyText: document.body ? document.body.innerText : ''
        }
      }
      button.click()
      return { clicked: true }
    })()
  `, true)

  if (!result.clicked) {
    throw new Error(`Unable to click button "${text}": ${JSON.stringify(result)}`)
  }
}

async function clickLoginModeSwitch (window) {
  const result = await window.webContents.executeJavaScript(`
    (() => {
      const button = document.querySelector('.login-mode-switch')
      if (!button || button.disabled) {
        return {
          clicked: false,
          hasButton: Boolean(button),
          disabled: button ? button.disabled : null,
          bodyText: document.body ? document.body.innerText : ''
        }
      }
      button.click()
      return { clicked: true }
    })()
  `, true)

  if (!result.clicked) {
    throw new Error(`Unable to switch login mode: ${JSON.stringify(result)}`)
  }

  await waitForCondition(
    window,
    "Boolean(document.querySelector('.login-modal:not(.login-modal-flipping) input.form-control'))",
    'interactive token login form',
    loginModalFlipSettleMs + 3000
  )
}

async function submitToken (window, token) {
  await clickLoginModeSwitch(window)

  const result = await window.webContents.executeJavaScript(`
    (() => {
      const input = document.querySelector('.login-modal input.form-control')
      if (!input) return { submitted: false, reason: 'missing-input' }

      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      valueSetter.call(input, ${JSON.stringify(token)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))

      const button = Array.from(document.querySelectorAll('button'))
        .find(candidate => candidate.innerText.trim() === 'Token Login')
      if (!button || button.disabled) {
        return {
          submitted: false,
          reason: 'missing-or-disabled-button',
          hasButton: Boolean(button),
          disabled: button ? button.disabled : null
        }
      }
      button.click()
      return { submitted: true }
    })()
  `, true)

  if (!result.submitted) {
    throw new Error(`Unable to submit token login: ${JSON.stringify(result)}`)
  }
}

async function waitForInitialLogin (window) {
  await waitForCondition(
    window,
    [
      "Boolean(document.querySelector('.login-modal'))",
      "document.body && document.body.innerText.includes('Login')",
      "document.body && document.body.innerText.includes('GitHub Login')",
      "!document.querySelector('.login-status-line')",
      "!document.querySelector('.login-modal input.form-control')"
    ].join(' && '),
    'initial credentials login modal'
  )
}

async function waitForLoginFailure (window) {
  await waitForCondition(
    window,
    [
      "Boolean(document.querySelector('.login-modal'))",
      "document.body && document.body.innerText.includes('Sign-in failed.')",
      "Array.from(document.querySelectorAll('button')).some(button => button.innerText.trim() === 'GitHub Login' && !button.disabled)"
    ].join(' && '),
    'recoverable login failure'
  )
}

async function waitForActiveUser (window, login) {
  await waitForCondition(
    window,
    [
      "Boolean(document.querySelector('.active-layout'))",
      `document.body && document.body.innerText.toLowerCase().includes(${JSON.stringify(login.toLowerCase())})`
    ].join(' && '),
    `active session for ${login}`
  )
}

function storagePath (key) {
  const fileName = path.basename(key, '.json') + '.json'
  return path.join(app.getPath('userData'), 'storage', encodeURIComponent(fileName))
}

function readStorageValue (key) {
  try {
    return JSON.parse(fs.readFileSync(storagePath(key), 'utf8'))
  } catch (error) {
    return undefined
  }
}

async function waitForCachedCredentialClear () {
  const deadline = Date.now() + 10000

  while (Date.now() < deadline) {
    if (readStorageValue('token') === null && readStorageValue('profile') === null) return
    await wait(100)
  }

  throw new Error(`Timed out waiting for cached credential clear: ${JSON.stringify({
    token: readStorageValue('token'),
    profile: readStorageValue('profile')
  })}`)
}

async function captureScreenshot (window, fileName) {
  if (!artifactDir || !window || window.isDestroyed()) return

  const screenshotPath = path.join(artifactDir, fileName)
  await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
  `, true)
  await wait(250)
  const image = await window.capturePage()
  fs.writeFileSync(screenshotPath, image.toPNG())
  console.log(`Saved login-flow screenshot to ${screenshotPath}`)
}

async function assertInitialLoginAfterInvalidCredential (window) {
  await waitForCondition(
    window,
    [
      "Boolean(document.querySelector('.login-modal'))",
      "document.body && document.body.innerText.includes('Login')",
      "document.body && document.body.innerText.includes('GitHub Login')",
      `document.body && document.body.innerText.includes(${JSON.stringify(invalidTokenMessage)})`,
      "!document.querySelector('.login-modal input.form-control')"
    ].join(' && '),
    'retryable credentials login modal with invalid token message'
  )
  const state = await getRendererState(window)
  if (!state.bodyText.includes(invalidTokenMessage)) {
    throw new Error(`Invalid credential should explain the token failure: ${JSON.stringify(state)}`)
  }
  if (/See log|Please check your network condition/.test(state.bodyText)) {
    throw new Error(`Invalid credential should not show system-level error affordances: ${JSON.stringify(state)}`)
  }
}

async function runScenario (window) {
  switch (scenario) {
    case 'oauth-success':
      await waitForInitialLogin(window)
      await clickButton(window, 'GitHub Login')
      await waitForActiveUser(window, 'oauth-user')
      return
    case 'oauth-denied-retry':
      await waitForInitialLogin(window)
      await clickButton(window, 'GitHub Login')
      await waitForLoginFailure(window)
      await clickButton(window, 'GitHub Login')
      await waitForActiveUser(window, 'oauth-user')
      return
    case 'oauth-exchange-failure-retry':
      await waitForInitialLogin(window)
      await clickButton(window, 'GitHub Login')
      await waitForLoginFailure(window)
      await clickButton(window, 'GitHub Login')
      await waitForActiveUser(window, 'oauth-user')
      return
    case 'manual-token-success':
      await waitForInitialLogin(window)
      await submitToken(window, 'manual-good-token')
      await waitForActiveUser(window, 'manual-user')
      return
    case 'manual-token-invalid':
      await waitForInitialLogin(window)
      await submitToken(window, 'manual-bad-token')
      await assertInitialLoginAfterInvalidCredential(window)
      return
    case 'cached-token-success':
      await waitForActiveUser(window, 'cached-user')
      return
    case 'cached-token-invalid':
      await waitForCachedCredentialClear()
      await assertInitialLoginAfterInvalidCredential(window)
      return
    default:
      throw new Error(`Unsupported login-flow scenario: ${scenario}`)
  }
}

async function main () {
  let window

  try {
    window = await waitForMainWindow()
    attachRendererDiagnostics(window)
    await waitForRendererLoad(window)
    await runScenario(window)
    await captureScreenshot(window, `electron-login-flow-${scenario}-success.png`)
    console.log(`electron login-flow smoke test passed: ${scenario}`)
    app.exit(0)
  } catch (error) {
    await captureScreenshot(window, `electron-login-flow-${scenario || 'unknown'}-failure.png`)
    console.error(error)
    app.exit(1)
  }
}

app.whenReady().then(main)
