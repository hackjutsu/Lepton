const fs = require('fs')
const path = require('path')
const { app, BrowserWindow } = require('electron')

const repoRoot = path.resolve(__dirname, '../..')

app.getAppPath = () => repoRoot

require(path.join(repoRoot, 'main.js'))

const rendererEvents = []

function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForMainWindow () {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const window = BrowserWindow.getAllWindows()[0]
    if (window && !window.isDestroyed()) return window
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

async function waitForLoginUi (window) {
  const found = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const deadline = Date.now() + 30000
      function check() {
        if (document.querySelector('.app-container') && document.querySelector('.login-modal')) {
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

  if (!found) {
    const state = await getRendererState(window)
    throw new Error([
      'Timed out waiting for the login UI to render.',
      `Renderer state: ${JSON.stringify(state)}`,
      `Renderer events: ${rendererEvents.join('\n') || '(none)'}`
    ].join('\n'))
  }
}

async function waitForFixtureUi (window) {
  const expectedSelector = process.env.LEPTON_SMOKE_EXPECTED_SELECTOR
  if (!expectedSelector) {
    throw new Error('LEPTON_SMOKE_EXPECTED_SELECTOR is required for render fixture smoke tests.')
  }

  const found = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const deadline = Date.now() + 30000
      const expectedSelector = ${JSON.stringify(expectedSelector)}
      function check() {
        if (document.querySelector('.app-container') && document.querySelector(expectedSelector)) {
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

  if (!found) {
    const state = await getRendererState(window)
    throw new Error([
      `Timed out waiting for render fixture "${process.env.LEPTON_RENDER_FIXTURE}" to render selector "${expectedSelector}".`,
      `Renderer state: ${JSON.stringify(state)}`,
      `Renderer events: ${rendererEvents.join('\n') || '(none)'}`
    ].join('\n'))
  }
}

async function getRendererState (window) {
  const expectedSelector = process.env.LEPTON_SMOKE_EXPECTED_SELECTOR || ''
  return window.webContents.executeJavaScript(`
    (() => {
      const appContainer = document.querySelector('.app-container')
      const loginModal = document.querySelector('.login-modal')
      const expectedSelector = ${JSON.stringify(expectedSelector)}
      const appBounds = appContainer ? appContainer.getBoundingClientRect() : null
      const languageSelector = document.querySelector('[data-role="language-selector"]')
      const images = Array.from(document.images).map(image => {
        const bounds = image.getBoundingClientRect()
        return {
          className: image.className || '',
          complete: image.complete,
          currentSrc: image.currentSrc || '',
          height: bounds.height,
          naturalHeight: image.naturalHeight,
          naturalWidth: image.naturalWidth,
          src: image.getAttribute('src') || '',
          width: bounds.width
        }
      })
      return {
        bodyText: document.body ? document.body.innerText : '',
        bodyHtml: document.body ? document.body.innerHTML : '',
        location: window.location ? window.location.href : '',
        readyState: document.readyState,
        hasAppContainer: Boolean(appContainer),
        hasLoginModal: Boolean(loginModal),
        hasExpectedSelector: expectedSelector ? Boolean(document.querySelector(expectedSelector)) : true,
        hasLeptonBridge: Boolean(window.lepton),
        hasLeptonConfigBridge: Boolean(window.lepton && window.lepton.config && window.lepton.config.get),
        processType: typeof process,
        requireType: typeof require,
        languageOptions: languageSelector
          ? Array.from(languageSelector.options).map(option => option.value)
          : [],
        images,
        appBounds: appBounds ? {
          width: appBounds.width,
          height: appBounds.height
        } : null
      }
    })()
  `, true)
}

async function captureScreenshot (window, fileName, log = console.log) {
  if (!window || window.isDestroyed()) return

  const artifactDir = process.env.LEPTON_SMOKE_ARTIFACT_DIR
  if (!artifactDir) return

  const screenshotPath = path.join(artifactDir, fileName)
  await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
  `, true)
  await wait(250)
  const image = await window.capturePage()
  fs.writeFileSync(screenshotPath, image.toPNG())
  log(`Saved smoke-test screenshot to ${screenshotPath}`)
}

function getBlockingRendererEvents () {
  return rendererEvents.filter(event => {
    if (/Download the React DevTools|Electron Security Warning/.test(event)) return false
    return /console:(error|warning)|did-fail-load|render-process-gone|renderer crashed/.test(event)
  })
}

function assertSharedRendererState (state) {
  if (!state.hasAppContainer) {
    throw new Error(`Expected app container to exist: ${JSON.stringify(state)}`)
  }

  if (!state.hasLeptonBridge || !state.hasLeptonConfigBridge) {
    throw new Error(`Expected preload bridge to be available: ${JSON.stringify(state)}`)
  }

  if (state.requireType !== 'undefined' || state.processType !== 'undefined') {
    throw new Error(`Expected renderer Node globals to be unavailable: ${JSON.stringify({
      processType: state.processType,
      requireType: state.requireType
    })}`)
  }

  if (!state.appBounds || state.appBounds.width <= 0 || state.appBounds.height <= 0) {
    throw new Error(`App container did not render with visible dimensions: ${JSON.stringify(state.appBounds)}`)
  }
}

function assertNoBlockingRendererEvents () {
  const blockingEvents = getBlockingRendererEvents()
  if (blockingEvents.length > 0) {
    throw new Error(`Renderer emitted warnings/errors while rendering fixture:\n${blockingEvents.join('\n')}`)
  }
}

function assertLoadedRendererImages (state) {
  const brokenImages = (state.images || []).filter(image =>
    !image.complete ||
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0
  )

  if (brokenImages.length > 0) {
    throw new Error(`Renderer images failed to load: ${JSON.stringify(brokenImages)}`)
  }
}

function assertImagePresent (state, className) {
  const image = (state.images || []).find(image => image.className.includes(className))
  if (!image) {
    throw new Error(`Expected renderer image with class "${className}" to exist: ${JSON.stringify(state.images || [])}`)
  }
}

function assertLoginRendererState (state) {
  assertSharedRendererState(state)
  assertLoadedRendererImages(state)
  assertImagePresent(state, 'profile-image-modal')

  if (!state.hasAppContainer || !state.hasLoginModal) {
    throw new Error(`Expected app container and login modal to exist: ${JSON.stringify(state)}`)
  }

  const expectedTexts = (process.env.LEPTON_SMOKE_EXPECTED_TEXT || 'Login|GitHub Login').split('|')
  const missingText = expectedTexts.find(text => !state.bodyText.includes(text))
  if (missingText) {
    throw new Error(`Expected login UI text "${missingText}" was not visible. Body text: ${state.bodyText}`)
  }

  const expectedLocales = ['en', 'es', 'fr', 'ja', 'ko', 'zh-Hans', 'zh-Hant']
  if (expectedLocales.some(locale => !state.languageOptions.includes(locale))) {
    throw new Error(`Expected language selector options were not visible: ${JSON.stringify(state.languageOptions)}`)
  }
}

function assertFixtureRendererState (state) {
  assertSharedRendererState(state)
  assertNoBlockingRendererEvents()
  assertLoadedRendererImages(state)

  if (!state.hasExpectedSelector) {
    throw new Error(`Expected fixture selector was not visible: ${process.env.LEPTON_SMOKE_EXPECTED_SELECTOR}`)
  }

  const expectedTexts = (process.env.LEPTON_SMOKE_EXPECTED_TEXT || '').split('|').filter(Boolean)
  const missingText = expectedTexts.find(text => !state.bodyText.includes(text))
  if (missingText) {
    throw new Error(`Expected fixture UI text "${missingText}" was not visible. Body text: ${state.bodyText}`)
  }
}

async function main () {
  let window

  try {
    window = await waitForMainWindow()
    attachRendererDiagnostics(window)
    await waitForRendererLoad(window)

    if (process.env.LEPTON_RENDER_FIXTURE) {
      await waitForFixtureUi(window)
      assertFixtureRendererState(await getRendererState(window))
      await captureScreenshot(window, `electron-render-${process.env.LEPTON_RENDER_FIXTURE}-success.png`)
      console.log(`electron render fixture smoke test passed: ${process.env.LEPTON_RENDER_FIXTURE}`)
    } else {
      await waitForLoginUi(window)
      assertLoginRendererState(await getRendererState(window))
      await captureScreenshot(window, 'electron-render-smoke-success.png')
      console.log('electron render smoke test passed')
    }

    app.exit(0)
  } catch (err) {
    await captureScreenshot(window, 'electron-render-smoke-failure.png', console.error)
    console.error(err)
    app.exit(1)
  }
}

app.whenReady().then(main)
