const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const { app, BrowserWindow } = require('electron')

const repoRoot = path.resolve(__dirname, '../..')
const loginModalFlipSettleMs = 700

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
      const forbiddenSelector = ${JSON.stringify(process.env.LEPTON_SMOKE_FORBIDDEN_SELECTOR || '')}
      const appBounds = appContainer ? appContainer.getBoundingClientRect() : null
      const languageSelector = document.querySelector('[data-role="language-selector"]')
      const languageSelectorLabel = document.querySelector('.login-language-selector')
      const loginModeSwitch = document.querySelector('.login-mode-switch')
      const tagSections = Array.from(document.querySelectorAll('.tag-section-list > .tag-section'))
      const filterSections = [tagSections[0], tagSections[2]].filter(Boolean)
      const activeFilterLabels = filterSections.flatMap(section =>
        Array.from(section.querySelectorAll('[aria-pressed="true"]'))
          .map(filter => filter.innerText.trim())
      )
      const snippetTitles = Array.from(document.querySelectorAll('.snippet-thumnail-description'))
        .map(snippet => snippet.innerText.trim())
      const providerSelector = document.querySelector('[aria-label="Snippet provider"]')
      const gitLabHostInput = document.querySelector('[aria-label="GitLab instance host"]')
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
        hasForbiddenSelector: forbiddenSelector ? Boolean(document.querySelector(forbiddenSelector)) : false,
        hasLeptonBridge: Boolean(window.lepton),
        hasLeptonConfigBridge: Boolean(window.lepton && window.lepton.config && window.lepton.config.get),
        activeFilterLabels,
        snippetTitles,
        processType: typeof process,
        requireType: typeof require,
        languageOptions: languageSelector
          ? Array.from(languageSelector.options).map(option => option.value)
          : [],
        languageSelectorTooltip: languageSelectorLabel ? languageSelectorLabel.getAttribute('data-tooltip') : '',
        languageSelectorTitle: languageSelectorLabel ? languageSelectorLabel.getAttribute('title') : '',
        loginModeSwitch: loginModeSwitch
          ? {
              ariaLabel: loginModeSwitch.getAttribute('aria-label') || '',
              dataTooltip: loginModeSwitch.getAttribute('data-tooltip') || '',
              text: loginModeSwitch.innerText || '',
              title: loginModeSwitch.getAttribute('title') || ''
            }
          : null,
        providerType: providerSelector ? providerSelector.value : '',
        gitLabHost: gitLabHostInput ? gitLabHostInput.value : '',
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

  const expectedProvider = process.env.LEPTON_SMOKE_EXPECTED_PROVIDER || 'github'
  const expectedTexts = (process.env.LEPTON_SMOKE_EXPECTED_TEXT || 'Login|GitHub Login').split('|')
  const missingText = expectedTexts.find(text => !state.bodyText.includes(text))
  if (missingText) {
    throw new Error(`Expected login UI text "${missingText}" was not visible. Body text: ${state.bodyText}`)
  }

  const expectedLocales = ['en', 'es', 'fr', 'ja', 'ko', 'zh-Hans', 'zh-Hant']
  if (expectedLocales.some(locale => !state.languageOptions.includes(locale))) {
    throw new Error(`Expected language selector options were not visible: ${JSON.stringify(state.languageOptions)}`)
  }

  if (state.providerType !== expectedProvider) {
    throw new Error(`Expected ${expectedProvider} provider to be selected: ${JSON.stringify(state)}`)
  }

  if (expectedProvider === 'gitlab') {
    if (state.loginModeSwitch) {
      throw new Error(`Expected GitLab login to stay in token-only mode: ${JSON.stringify(state)}`)
    }
    if (!state.gitLabHost) {
      throw new Error(`Expected GitLab instance host control to be visible: ${JSON.stringify(state)}`)
    }
    return
  }

  if (!state.loginModeSwitch) {
    throw new Error(`Expected login mode switch icon to be visible: ${JSON.stringify(state)}`)
  }

  if (state.loginModeSwitch.title) {
    throw new Error(`Expected login mode switch to avoid native delayed title tooltips: ${JSON.stringify(state.loginModeSwitch)}`)
  }

  if (!state.loginModeSwitch.dataTooltip || state.loginModeSwitch.dataTooltip !== state.loginModeSwitch.ariaLabel) {
    throw new Error(`Expected login mode switch to expose a custom tooltip matching its accessible label: ${JSON.stringify(state.loginModeSwitch)}`)
  }

  if ((state.loginModeSwitch.text || '').trim().length > 3) {
    throw new Error(`Expected login mode switch to render as a compact icon: ${JSON.stringify(state.loginModeSwitch)}`)
  }

  if (state.languageSelectorTitle) {
    throw new Error(`Expected compact language selector to avoid native delayed title tooltips: ${JSON.stringify(state)}`)
  }

  if (!state.languageSelectorTooltip) {
    throw new Error(`Expected compact language selector to expose a custom tooltip: ${JSON.stringify(state)}`)
  }
}

async function assertLoginProviderSwitch (window) {
  if (process.env.LEPTON_SMOKE_SWITCH_PROVIDER !== '1') return

  const result = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const providerSelector = document.querySelector('[aria-label="Snippet provider"]')
      if (!providerSelector) {
        resolve({ reason: 'missing provider selector' })
        return
      }

      providerSelector.value = 'gitlab'
      providerSelector.dispatchEvent(new Event('change', { bubbles: true }))

      const controlsDeadline = Date.now() + 3000
      function updateGitLabHost () {
        const gitLabHostInput = document.querySelector('[aria-label="GitLab instance host"]')
        if ((!gitLabHostInput || gitLabHostInput.disabled) && Date.now() < controlsDeadline) {
          setTimeout(updateGitLabHost, 100)
          return
        }
        const gitLabState = {
          hasHost: Boolean(gitLabHostInput),
          initialHost: gitLabHostInput ? gitLabHostInput.value : null,
          hasModeSwitch: Boolean(document.querySelector('.login-mode-switch')),
          hasTokenLogin: document.body.innerText.includes('GitLab Token Login'),
          persistedProvider: window.lepton.config.get('provider:type')
        }

        if (gitLabHostInput) {
          const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          gitLabHostInput.focus()
          valueSetter.call(gitLabHostInput, 'gitlab.smoke.test')
          gitLabHostInput.dispatchEvent(new Event('input', { bubbles: true }))
          gitLabHostInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
        }

        const hostDeadline = Date.now() + 3000
        function finishProviderSwitch () {
          const persistedHost = window.lepton.config.get('gitlab:host')
          if (persistedHost !== 'https://gitlab.smoke.test' && Date.now() < hostDeadline) {
            setTimeout(finishProviderSwitch, 100)
            return
          }
          const activeProviderSelector = document.querySelector('[aria-label="Snippet provider"]')
          gitLabState.persistedHost = persistedHost
          activeProviderSelector.value = 'github'
          activeProviderSelector.dispatchEvent(new Event('change', { bubbles: true }))

          setTimeout(() => resolve({
            gitLabState,
            restored: {
              hasGitHubLogin: document.body.innerText.includes('GitHub Login'),
              hasModeSwitch: Boolean(document.querySelector('.login-mode-switch')),
              persistedProvider: window.lepton.config.get('provider:type')
            }
          }), 300)
        }
        finishProviderSwitch()
      }
      updateGitLabHost()
    })
  `, true)

  if (
    !result.gitLabState ||
    !result.gitLabState.hasHost ||
    result.gitLabState.initialHost !== 'https://gitlab.com' ||
    result.gitLabState.hasModeSwitch ||
    !result.gitLabState.hasTokenLogin ||
    result.gitLabState.persistedProvider !== 'gitlab' ||
    result.gitLabState.persistedHost !== 'https://gitlab.smoke.test'
  ) {
    throw new Error(`Expected provider selector to persist a token-only GitLab login: ${JSON.stringify(result)}`)
  }

  if (
    !result.restored ||
    !result.restored.hasGitHubLogin ||
    !result.restored.hasModeSwitch ||
    result.restored.persistedProvider !== 'github'
  ) {
    throw new Error(`Expected provider selector to restore GitHub OAuth login: ${JSON.stringify(result)}`)
  }
}

async function assertProviderBridgeIsolation (window) {
  const activeProviderType = process.env.LEPTON_SMOKE_EXPECTED_PROVIDER || 'github'
  const inactiveProvider = activeProviderType === 'gitlab'
    ? { type: 'github', baseUrl: 'https://github.com' }
    : { type: 'gitlab', baseUrl: 'https://attacker.example' }
  const inactiveScope = `${inactiveProvider.type}:${inactiveProvider.baseUrl}`
  const inactiveTokenKey = `token:${encodeURIComponent(inactiveScope)}`
  const scopedStorageAlias = `scoped-v1-${crypto.createHash('sha256')
    .update('lepton-scoped-storage-v1\0')
    .update(inactiveTokenKey)
    .digest('hex')}`

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const provider = ${JSON.stringify(inactiveProvider)}
      const scope = ${JSON.stringify(inactiveScope)}
      const scopedStorageAlias = ${JSON.stringify(scopedStorageAlias)}
      return {
        secretConfigParentRead: window.lepton.config.get('enterprise'),
        secretConfigRead: window.lepton.config.get('enterprise:token'),
        secretConfigWrite: await window.lepton.config.set('enterprise:token', 'inactive-provider-token'),
        secretConfigRestartWrite: await window.lepton.config.setForRestart('enterprise:token', 'inactive-provider-token'),
        credentialRead: window.lepton.credentials.getAccessToken(scope),
        credentialWrite: window.lepton.credentials.setAccessToken('inactive-provider-token', scope),
        rawStorageRead: window.lepton.localStorage.get('token:' + encodeURIComponent(scope)),
        rawScopedAliasWrite: window.lepton.localStorage.set(scopedStorageAlias, 'inactive-provider-token'),
        snippetRequest: await window.lepton.snippets.request(provider, 'GET_USER_PROFILE', ['inactive-provider-token'])
      }
    })()
  `, true)

  if (result.secretConfigParentRead !== undefined || result.secretConfigRead !== undefined ||
    result.secretConfigWrite !== undefined ||
    result.secretConfigRestartWrite !== undefined || result.credentialRead.status ||
    result.credentialWrite.status || result.rawStorageRead.status || result.rawScopedAliasWrite.status ||
    !result.snippetRequest || result.snippetRequest.ok !== false) {
    throw new Error(`Expected main-process provider boundaries to reject inactive credentials and API requests: ${JSON.stringify(result)}`)
  }
}

async function assertHeaderTooltipContract (window, selector) {
  const tooltipState = await window.webContents.executeJavaScript(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)})
      if (!element) return null

      function delayToMs(value) {
        return value.split(',').reduce((maxDelay, rawDelay) => {
          const delay = rawDelay.trim()
          const multiplier = delay.endsWith('ms') ? 1 : 1000
          const parsed = Number.parseFloat(delay)
          return Number.isFinite(parsed) ? Math.max(maxDelay, parsed * multiplier) : maxDelay
        }, 0)
      }

      const restingStyle = window.getComputedStyle(element, '::after')
      return {
        content: restingStyle.content,
        dataTooltip: element.getAttribute('data-tooltip') || '',
        delayMs: delayToMs(restingStyle.transitionDelay || ''),
        title: element.getAttribute('title') || ''
      }
    })()
  `, true)

  if (!tooltipState) {
    throw new Error(`Expected tooltip target to exist: ${selector}`)
  }

  if (!tooltipState.dataTooltip) {
    throw new Error(`Expected tooltip target to expose data-tooltip: ${JSON.stringify({ selector, tooltipState })}`)
  }

  if (tooltipState.title) {
    throw new Error(`Expected tooltip target to avoid native title tooltip: ${JSON.stringify({ selector, tooltipState })}`)
  }

  if (tooltipState.delayMs > 200) {
    throw new Error(`Expected custom tooltip delay to stay short: ${JSON.stringify({ selector, tooltipState })}`)
  }

  if (!tooltipState.content.includes(tooltipState.dataTooltip)) {
    throw new Error(`Expected custom tooltip text to be rendered by CSS: ${JSON.stringify({
      selector,
      tooltipState
    })}`)
  }
}

async function assertLoginHeaderTooltips (window) {
  await assertHeaderTooltipContract(window, '.login-mode-switch')
  await assertHeaderTooltipContract(window, '.login-language-selector')
}

async function assertLoginModeSwitchKeepsModalHeight (window) {
  const result = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const modalContent = document.querySelector('.login-modal .modal-content')
      const switchButton = document.querySelector('.login-mode-switch')

      function getHeight() {
        return modalContent ? Math.round(modalContent.getBoundingClientRect().height) : null
      }

      if (!modalContent || !switchButton) {
        resolve({
          reason: 'missing modal content or mode switch',
          before: getHeight(),
          hasSwitch: Boolean(switchButton)
        })
        return
      }

      const before = getHeight()
      switchButton.click()

      setTimeout(() => {
        const afterSwitch = getHeight()
        const hasTokenInput = Boolean(document.querySelector('.login-modal input.form-control'))
        const updatedSwitchButton = document.querySelector('.login-mode-switch')

        if (updatedSwitchButton) updatedSwitchButton.click()

        setTimeout(() => {
          resolve({
            afterSwitch,
            before,
            hasTokenInput,
            restored: getHeight()
          })
        }, ${loginModalFlipSettleMs})
      }, ${loginModalFlipSettleMs})
    })
  `, true)

  if (!result.hasTokenInput) {
    throw new Error(`Expected login mode switch to render the token form: ${JSON.stringify(result)}`)
  }

  if (Math.abs(result.before - result.afterSwitch) > 1 || Math.abs(result.before - result.restored) > 1) {
    throw new Error(`Expected login modal height to stay fixed across mode switches: ${JSON.stringify(result)}`)
  }
}

async function assertLoginLocaleSwitchRendersInPlace (window) {
  const result = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const modalContent = document.querySelector('.login-modal .modal-content')
      const languageSelector = document.querySelector('[data-role="language-selector"]')

      function getHeight() {
        return modalContent ? Math.round(modalContent.getBoundingClientRect().height) : null
      }

      if (!modalContent || !languageSelector) {
        resolve({
          reason: 'missing modal content or language selector',
          before: getHeight(),
          hasLanguageSelector: Boolean(languageSelector)
        })
        return
      }

      const before = getHeight()
      const targetLocale = languageSelector.value === 'ja' ? 'en' : 'ja'
      const expectedTitle = targetLocale === 'ja' ? 'ログイン' : 'Login'
      languageSelector.value = targetLocale
      languageSelector.dispatchEvent(new Event('change', { bubbles: true }))

      setTimeout(() => {
        resolve({
          afterSwitch: getHeight(),
          bodyText: document.body ? document.body.innerText : '',
          expectedTitle,
          selectedLocale: languageSelector.value,
          targetLocale
        })
      }, ${loginModalFlipSettleMs})
    })
  `, true)

  if (result.selectedLocale !== result.targetLocale) {
    throw new Error(`Expected language selector to keep the selected locale: ${JSON.stringify(result)}`)
  }

  if (!result.bodyText || !result.bodyText.includes(result.expectedTitle)) {
    throw new Error(`Expected login modal to render the selected locale in place: ${JSON.stringify(result)}`)
  }

  if (Math.abs(result.before - result.afterSwitch) > 1) {
    throw new Error(`Expected login modal height to stay fixed across locale switches: ${JSON.stringify(result)}`)
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

  const expectedActiveFilters = (process.env.LEPTON_SMOKE_EXPECTED_ACTIVE_FILTERS || '')
    .split('|')
    .filter(Boolean)
    .sort()
  if (expectedActiveFilters.length > 0) {
    const activeFilterLabels = [...state.activeFilterLabels].sort()
    if (JSON.stringify(activeFilterLabels) !== JSON.stringify(expectedActiveFilters)) {
      throw new Error(`Expected exact active gist filters ${JSON.stringify(expectedActiveFilters)}, received ${JSON.stringify(activeFilterLabels)}`)
    }
  }

  const expectedSnippetTitles = (process.env.LEPTON_SMOKE_EXPECTED_SNIPPET_TITLES || '')
    .split('|')
    .filter(Boolean)
  if (expectedSnippetTitles.length > 0 && JSON.stringify(state.snippetTitles) !== JSON.stringify(expectedSnippetTitles)) {
    throw new Error(`Expected exact snippet titles ${JSON.stringify(expectedSnippetTitles)}, received ${JSON.stringify(state.snippetTitles)}`)
  }

  const expectedSnippetCount = process.env.LEPTON_SMOKE_EXPECTED_SNIPPET_COUNT
  if (expectedSnippetCount !== '' && state.snippetTitles.length !== Number(expectedSnippetCount)) {
    throw new Error(`Expected ${expectedSnippetCount} snippet thumbnails, received ${state.snippetTitles.length}`)
  }

  assertForbiddenFixtureTextAbsent(state)
  assertForbiddenFixtureSelectorAbsent(state)
}

function assertForbiddenFixtureTextAbsent (state) {
  const forbiddenTexts = (process.env.LEPTON_SMOKE_FORBIDDEN_TEXT || '').split('|').filter(Boolean)
  const visibleForbiddenText = forbiddenTexts.find(text => state.bodyText.includes(text))
  if (visibleForbiddenText) {
    throw new Error(`Forbidden fixture UI text "${visibleForbiddenText}" was visible. Body text: ${state.bodyText}`)
  }
}

function assertForbiddenFixtureSelectorAbsent (state) {
  if (!state.hasForbiddenSelector) return
  throw new Error(`Forbidden fixture selector was visible: ${process.env.LEPTON_SMOKE_FORBIDDEN_SELECTOR}`)
}

async function applyFixtureFilterClicks (window) {
  const filterActions = JSON.parse(process.env.LEPTON_SMOKE_FILTER_ACTIONS || '[]')
  if (filterActions.length === 0) return

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const actions = ${JSON.stringify(filterActions)}
      const missingLabels = []

      for (const action of actions) {
        const sections = Array.from(document.querySelectorAll('.tag-section-list > .tag-section'))
        const controls = [sections[0], sections[2]]
          .filter(Boolean)
          .flatMap(section => Array.from(section.querySelectorAll('[role="button"]')))
        const control = controls.find(candidate => candidate.innerText.trim() === action.label)
        if (!control) {
          missingLabels.push(action.label)
          continue
        }
        control.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          shiftKey: Boolean(action.shiftKey)
        }))
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      return { missingLabels }
    })()
  `, true)

  if (result.missingLabels.length > 0) {
    throw new Error(`Unable to click fixture filters: ${JSON.stringify(result.missingLabels)}`)
  }

  await wait(250)
}

async function assertFixtureLoginModeSwitch (window) {
  if (process.env.LEPTON_SMOKE_SWITCH_LOGIN_MODE !== '1') return

  const result = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const switchButton = document.querySelector('.login-mode-switch')

      if (!switchButton) {
        resolve({
          reason: 'missing login mode switch',
          bodyText: document.body ? document.body.innerText : ''
        })
        return
      }

      switchButton.click()

      setTimeout(() => {
        resolve({
          bodyText: document.body ? document.body.innerText : '',
          hasTokenInput: Boolean(document.querySelector('.login-modal input.form-control'))
        })
      }, ${loginModalFlipSettleMs})
    })
  `, true)

  if (!result.hasTokenInput) {
    throw new Error(`Expected fixture login mode switch to render the token form: ${JSON.stringify(result)}`)
  }

  const expectedTexts = (process.env.LEPTON_SMOKE_AFTER_SWITCH_TEXT || '').split('|').filter(Boolean)
  const missingText = expectedTexts.find(text => !result.bodyText.includes(text))
  if (missingText) {
    throw new Error(`Expected fixture UI text "${missingText}" after login mode switch was not visible. Body text: ${result.bodyText}`)
  }

  assertForbiddenFixtureTextAbsent(result)
}

async function assertFixturePageFind (window) {
  const fixture = process.env.LEPTON_RENDER_FIXTURE
  if (fixture !== 'active' && fixture !== 'search') return

  const shortcutState = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        ctrlKey: ${process.platform !== 'darwin'},
        key: 'f',
        metaKey: ${process.platform === 'darwin'}
      }))

      const deadline = Date.now() + 1000
      function waitForFindBar() {
        const input = document.querySelector('.find-in-page-input')
        if (input || Date.now() > deadline) {
          resolve({
            focused: input === document.activeElement,
            hasFindBar: Boolean(input)
          })
          return
        }
        setTimeout(waitForFindBar, 50)
      }
      waitForFindBar()
    })
  `, true)

  if (fixture === 'active' && shortcutState.hasFindBar) {
    await window.webContents.insertText('fixture')
    const resultState = await window.webContents.executeJavaScript(`
      new Promise(resolve => {
        const deadline = Date.now() + 5000
        function waitForResults() {
          const count = document.querySelector('.find-in-page-count')
          const input = document.querySelector('.find-in-page-input')
          const countText = count ? count.textContent : ''
          if (countText && countText !== '0/0') {
            resolve({
              countText,
              focusedAfterFind: input === document.activeElement,
              value: input ? input.value : ''
            })
            return
          }
          if (Date.now() > deadline) {
            resolve({ countText, reason: 'find results did not arrive', value: input ? input.value : '' })
            return
          }
          setTimeout(waitForResults, 50)
        }
        waitForResults()
      })
    `, true)
    Object.assign(shortcutState, resultState)

    shortcutState.rapidInput = await window.webContents.executeJavaScript(`
      new Promise(resolve => {
        const input = document.querySelector('.find-in-page-input')
        const count = document.querySelector('.find-in-page-count')
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        const values = [
          'fixtur', 'fixtu', 'fixt', 'fix', 'fi', 'f', '',
          'f', 'fi', 'fix', 'fixt', 'fixtu', 'fixtur', 'fixture'
        ]
        const startedAt = performance.now()

        input.focus()
        for (const value of values) {
          valueSetter.call(input, value)
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }

        const dispatchDurationMs = performance.now() - startedAt
        const deadline = Date.now() + 5000
        requestAnimationFrame(() => {
          const nextFrameDelayMs = performance.now() - startedAt
          function waitForSettledResults() {
            const countText = count ? count.textContent : ''
            if (input.value === 'fixture' && countText && countText !== '0/0') {
              resolve({
                countText,
                dispatchDurationMs,
                focused: input === document.activeElement,
                nextFrameDelayMs,
                value: input.value
              })
              return
            }
            if (Date.now() > deadline) {
              resolve({
                countText,
                dispatchDurationMs,
                focused: input === document.activeElement,
                nextFrameDelayMs,
                reason: 'rapid input results did not settle',
                value: input.value
              })
              return
            }
            setTimeout(waitForSettledResults, 25)
          }
          waitForSettledResults()
        })
      })
    `, true)

    const navigationStart = await window.webContents.executeJavaScript(`
      (() => {
        const count = document.querySelector('.find-in-page-count')
        const buttons = document.querySelectorAll('.find-in-page-button')
        return {
          initial: count ? count.textContent : '',
          targets: Array.from(buttons).slice(0, 2).map(button => {
            const rect = button.getBoundingClientRect()
            return {
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + rect.height / 2)
            }
          })
        }
      })()
    `, true)

    async function clickFindTarget (target) {
      window.webContents.sendInputEvent(Object.assign({
        button: 'left',
        clickCount: 1,
        type: 'mouseDown'
      }, target))
      window.webContents.sendInputEvent(Object.assign({
        button: 'left',
        clickCount: 1,
        type: 'mouseUp'
      }, target))
    }

    async function waitForFindCountChange (previousCount) {
      const deadline = Date.now() + 3000
      while (Date.now() <= deadline) {
        const state = await window.webContents.executeJavaScript(`
          (() => {
            const count = document.querySelector('.find-in-page-count')
            const input = document.querySelector('.find-in-page-input')
            return {
              countText: count ? count.textContent : '',
              focused: input === document.activeElement
            }
          })()
        `, true)
        if (state.countText && state.countText !== previousCount) return state
        await wait(25)
      }
      return { countText: previousCount, focused: false }
    }

    await clickFindTarget(navigationStart.targets[1])
    const nextState = await waitForFindCountChange(navigationStart.initial)
    await clickFindTarget(navigationStart.targets[0])
    const previousState = await waitForFindCountChange(nextState.countText)
    shortcutState.navigation = {
      focused: nextState.focused && previousState.focused,
      initial: navigationStart.initial,
      next: nextState.countText,
      previous: previousState.countText,
      targets: navigationStart.targets
    }

    shortcutState.highlights = await window.webContents.executeJavaScript(`
      (() => {
        const matches = CSS.highlights.get('lepton-find-match')
        const active = CSS.highlights.get('lepton-find-active')
        const activeRange = active ? active.values().next().value : null
        const activeRect = activeRange ? activeRange.getBoundingClientRect() : null
        const activeParent = activeRange ? activeRange.startContainer.parentElement : null
        const activeHitTarget = activeRect
          ? document.elementFromPoint(
            activeRect.left + (activeRect.width / 2),
            activeRect.top + (activeRect.height / 2)
          )
          : null
        return {
          active: active ? active.size : 0,
          activeExposed: Boolean(activeParent && activeHitTarget && (
            activeHitTarget === activeParent ||
            activeParent.contains(activeHitTarget) ||
            activeHitTarget.contains(activeParent)
          )),
          activeRect: activeRect ? {
            bottom: activeRect.bottom,
            left: activeRect.left,
            right: activeRect.right,
            top: activeRect.top
          } : null,
          activeParent: activeParent
            ? activeParent.tagName + '.' + activeParent.className
            : '',
          activeText: activeRange ? activeRange.toString() : '',
          activeStyle: activeRange && activeRange.startContainer.parentElement
            ? getComputedStyle(activeRange.startContainer.parentElement, '::highlight(lepton-find-active)').backgroundColor
            : '',
          activeVisible: Boolean(activeRect && activeRect.width > 0 && activeRect.height > 0),
          matches: matches ? matches.size : 0
        }
      })()
    `, true)
  }

  await wait(750)
  shortcutState.settledCountText = await window.webContents.executeJavaScript(`
    (() => {
      const count = document.querySelector('.find-in-page-count')
      return count ? count.textContent : ''
    })()
  `, true)
  if (fixture === 'search') {
    if (shortcutState.hasFindBar) {
      throw new Error(`Expected snippet-wide search to exclude page find: ${JSON.stringify(shortcutState)}`)
    }
    return
  }

  if (!shortcutState.hasFindBar ||
      !shortcutState.focused ||
      !shortcutState.focusedAfterFind ||
      shortcutState.value !== 'fixture' ||
      !shortcutState.rapidInput ||
      !shortcutState.rapidInput.focused ||
      shortcutState.rapidInput.value !== 'fixture' ||
      !shortcutState.navigation ||
      !shortcutState.navigation.focused ||
      shortcutState.navigation.next === shortcutState.navigation.initial ||
      shortcutState.navigation.previous === shortcutState.navigation.next ||
      !shortcutState.highlights ||
      shortcutState.highlights.active !== 1 ||
      !shortcutState.highlights.activeExposed ||
      !shortcutState.highlights.activeVisible ||
      shortcutState.highlights.matches < 2 ||
      !/^[1-9]\d*\/[1-9]\d*$/.test(shortcutState.rapidInput.countText || '') ||
      !/^[1-9]\d*\/[1-9]\d*$/.test(shortcutState.settledCountText || '')) {
    throw new Error(`Expected active snippet fixture to support local page find: ${JSON.stringify(shortcutState)}`)
  }
}

async function assertFixtureNewDraftRecovery (window) {
  if (process.env.LEPTON_RENDER_FIXTURE !== 'new-draft') return

  const recoveryState = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const description = document.querySelector('.gist-editor-input-area')
      const loadButton = Array.from(document.querySelectorAll('.new-gist-draft-actions button'))
        .find(button => button.textContent.trim() === 'Load draft')
      const initialState = {
        description: description ? description.value : null,
        hasHelper: document.body.innerText.includes('Submitting without loading the local draft will discard it.')
      }

      loadButton.click()
      setTimeout(() => {
        const loadedDescription = document.querySelector('.gist-editor-input-area')
        const loadedFilename = document.querySelector('.gist-editor-filename-area')
        const editor = document.querySelector('.CodeMirror')
        const loadedState = {
          content: editor && editor.CodeMirror ? editor.CodeMirror.getValue() : null,
          description: loadedDescription ? loadedDescription.value : null,
          filename: loadedFilename ? loadedFilename.value : null,
          hasHelper: document.body.innerText.includes('Submitting without loading the local draft will discard it.'),
          hasLoadedStatus: document.body.innerText.includes('Local draft loaded')
        }
        resolve({ initialState, loadedState })
      }, 100)
    })
  `, true)

  if (
    recoveryState.initialState.description !== '' ||
    !recoveryState.initialState.hasHelper ||
    recoveryState.loadedState.description !== 'Recovered API helper' ||
    recoveryState.loadedState.filename !== 'recovered.js' ||
    recoveryState.loadedState.content !== 'const recovered = true' ||
    recoveryState.loadedState.hasHelper ||
    !recoveryState.loadedState.hasLoadedStatus
  ) {
    throw new Error(`Expected local draft load/drop flow to preserve normal editor content: ${JSON.stringify(recoveryState)}`)
  }

  await captureScreenshot(window, 'electron-render-new-draft-loaded.png')

  const droppedState = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const dropButton = Array.from(document.querySelectorAll('.new-gist-draft-actions button'))
        .find(button => button.textContent.trim() === 'Drop draft')
      dropButton.click()
      setTimeout(() => {
        const description = document.querySelector('.gist-editor-input-area')
        resolve({
          description: description ? description.value : null,
          hasCallout: Boolean(document.querySelector('.new-gist-draft-callout'))
        })
      }, 100)
    })
  `, true)

  if (droppedState.description !== '' || droppedState.hasCallout) {
    throw new Error(`Expected dropping a loaded local draft to reset the editor: ${JSON.stringify(droppedState)}`)
  }
}

async function assertFixtureImagePreferences (window) {
  if (process.env.LEPTON_RENDER_FIXTURE !== 'about') return

  const result = await window.webContents.executeJavaScript(`
    new Promise(resolve => {
      const maxSize = document.querySelector('[data-preference-key="editor:imageMaxSizeKB"]')
      const getButton = text => Array.from(document.querySelectorAll('.preferences-footer button'))
        .find(button => button.textContent.trim() === text)
      const setInputValue = value => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(maxSize, value)
        maxSize.dispatchEvent(new Event('input', { bubbles: true }))
      }

      if (!maxSize) {
        resolve({ reason: 'missing image size preference' })
        return
      }

      const initial = {
        maxDisabled: maxSize.disabled,
        maxValue: maxSize.value
      }
      setInputValue('63')

      setTimeout(() => {
        const invalid = {
          applyDisabled: getButton('Apply').disabled,
          cancelDisabled: getButton('Cancel').disabled,
          hasError: document.body.innerText.includes('Maximum image size must be a whole number from 64 to 700 KB.'),
          saveDisabled: getButton('Save').disabled
        }
        setInputValue('64')

        setTimeout(() => {
          resolve({
            initial,
            invalid,
            valid: {
              applyDisabled: getButton('Apply').disabled,
              maxValue: maxSize.value,
              saveDisabled: getButton('Save').disabled
            }
          })
        }, 100)
      }, 100)
    })
  `, true)

  if (
    result.reason ||
    result.initial.maxDisabled ||
    result.initial.maxValue !== '512' ||
    !result.invalid.hasError ||
    !result.invalid.applyDisabled ||
    !result.invalid.saveDisabled ||
    result.invalid.cancelDisabled ||
    result.valid.maxValue !== '64' ||
    result.valid.applyDisabled ||
    result.valid.saveDisabled
  ) {
    throw new Error(`Expected image attachment preferences to validate and enable correctly: ${JSON.stringify(result)}`)
  }
}

async function assertFixtureImageAttachments (window) {
  if (process.env.LEPTON_RENDER_FIXTURE !== 'image-attachments') return

  const result = await window.webContents.executeJavaScript(`
    (async () => {
      const waitFor = async predicate => {
        const deadline = Date.now() + 5000
        while (Date.now() <= deadline) {
          const value = predicate()
          if (value) return value
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        return null
      }
      const imageRow = Array.from(document.querySelectorAll('.edit-modal .gist-editor-gist-file'))
        .find(row => {
          const filename = row.querySelector('.gist-editor-filename-area')
          return filename && filename.value === 'lepton-logo.webp'
        })
      const directView = imageRow && imageRow.querySelector('.image-file-view')
      const directImage = directView && directView.querySelector('.image-file-preview img')
      const markdownImage = document.querySelector('.lepton-markdown-sibling-image')
      const missingPlaceholder = await waitFor(() => Array.from(document.querySelectorAll('.lepton-markdown-image-placeholder'))
        .find(placeholder => placeholder.textContent.includes('Missing fixture') && placeholder.textContent.includes('missing-image.png')))
      const base64Button = directView && directView.querySelector('.image-file-view-toolbar button:nth-child(2)')
      const renderButton = directView && directView.querySelector('.image-file-view-toolbar button:first-child')
      const initial = {
        directComplete: Boolean(directImage && directImage.complete && directImage.naturalWidth > 0),
        directSource: directImage ? directImage.getAttribute('src') : '',
        markdownComplete: Boolean(markdownImage && markdownImage.complete && markdownImage.naturalWidth > 0),
        markdownSource: markdownImage ? markdownImage.getAttribute('src') : '',
        missingHasOpenAction: Boolean(missingPlaceholder && missingPlaceholder.querySelector('.lepton-markdown-image-open')),
        missingPlaceholder: Boolean(missingPlaceholder),
        renderPressed: renderButton ? renderButton.getAttribute('aria-pressed') : null
      }

      if (!base64Button || !renderButton || !directImage) {
        return { initial, reason: 'missing direct image controls' }
      }

      directImage.dispatchEvent(new Event('error', { bubbles: true }))
      const directFailure = await waitFor(() => directView.querySelector('.image-file-error'))
      const retryButton = directView.querySelector('.image-file-retry')
      const directFailureState = {
        base64Disabled: base64Button.disabled,
        hasMessage: Boolean(directFailure && directFailure.textContent.includes('cannot be rendered')),
        hasRetry: Boolean(retryButton),
        renderDisabled: renderButton.disabled
      }

      base64Button.click()
      const textarea = await waitFor(() => directView.querySelector('.image-file-base64'))
      const base64State = {
        contentLength: textarea ? textarea.value.length : 0,
        pressed: base64Button.getAttribute('aria-pressed')
      }

      renderButton.click()
      const restoredByRender = await waitFor(() => {
        const image = directView.querySelector('.image-file-preview img')
        return image && image.complete && image.naturalWidth > 0 ? image : null
      })
      if (restoredByRender) {
        restoredByRender.dispatchEvent(new Event('error', { bubbles: true }))
      }
      const retryAfterSecondFailure = await waitFor(() => directView.querySelector('.image-file-retry'))
      if (retryAfterSecondFailure) retryAfterSecondFailure.click()
      const restoredByRetry = await waitFor(() => {
        const image = directView.querySelector('.image-file-preview img')
        return image && image.complete && image.naturalWidth > 0 ? image : null
      })

      const imageSection = document.querySelector('[data-gist-filename="lepton-logo.webp"]')
      const imageHeader = imageSection && imageSection.querySelector('.file-expand')
      if (imageHeader && imageHeader.classList.contains('is-expanded')) imageHeader.click()
      const collapsedBeforeOpen = await waitFor(() => imageHeader && !imageHeader.classList.contains('is-expanded'))

      const currentMarkdownImage = document.querySelector('.lepton-markdown-sibling-image')
      if (currentMarkdownImage) currentMarkdownImage.dispatchEvent(new Event('error', { bubbles: true }))
      const markdownFailure = await waitFor(() => document.querySelector('.lepton-markdown-image-open[data-lepton-image-filename="lepton-logo.webp"]'))
      const markdownFailureState = {
        hasAlt: Boolean(markdownFailure && markdownFailure.parentElement.textContent.includes('Lepton fixture')),
        hasFilename: Boolean(markdownFailure && markdownFailure.parentElement.textContent.includes('lepton-logo.webp')),
        hasOpenAction: Boolean(markdownFailure),
        insideLink: Boolean(markdownFailure && markdownFailure.closest('a'))
      }
      if (markdownFailure) markdownFailure.click()
      const openedFromMarkdown = await waitFor(() => imageHeader &&
        imageHeader.classList.contains('is-expanded') &&
        document.activeElement === imageHeader)

      const markdownSection = document.querySelector('.markdown-section')
      const externalLinkNode = document.createElement('a')
      const externalImageNode = document.createElement('img')
      externalLinkNode.setAttribute('href', 'https://example.com/details')
      externalImageNode.className = 'lepton-markdown-image'
      externalImageNode.setAttribute('alt', 'External fixture')
      externalImageNode.setAttribute('src', restoredByRetry ? restoredByRetry.getAttribute('src') : '')
      externalLinkNode.appendChild(externalImageNode)
      if (markdownSection) markdownSection.appendChild(externalLinkNode)
      externalImageNode.dispatchEvent(new Event('error', { bubbles: true }))
      const externalFallback = await waitFor(() => Array.from(document.querySelectorAll('.lepton-markdown-image-placeholder'))
        .find(placeholder => placeholder.textContent.includes('External fixture')))
      const externalLink = externalFallback && externalFallback.closest('a')
      const externalLinkedFailure = {
        hasOpenAction: Boolean(externalFallback && externalFallback.querySelector('.lepton-markdown-image-open')),
        preservedLink: Boolean(externalLink && externalLink.getAttribute('href') === 'https://example.com/details')
      }

      const markdownRow = Array.from(document.querySelectorAll('.edit-modal .gist-editor-gist-file'))
        .find(row => {
          const filename = row.querySelector('.gist-editor-filename-area')
          return filename && filename.value === 'notes.md'
        })
      const editorElement = markdownRow && markdownRow.querySelector('.CodeMirror-scroll')
      if (!editorElement || !restoredByRetry || typeof DataTransfer === 'undefined') {
        return { base64State, initial, reason: 'missing editor drop target', restored: Boolean(restoredByRetry) }
      }

      const binary = atob(restoredByRetry.getAttribute('src').split(',')[1])
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
      const imageFile = new File([bytes], 'dropped-logo.webp', { type: 'image/webp' })
      const imageTransfer = new DataTransfer()
      imageTransfer.items.add(imageFile)
      const editorBounds = editorElement.getBoundingClientRect()
      editorElement.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: editorBounds.left + 24,
        clientY: editorBounds.top + 24,
        dataTransfer: imageTransfer
      }))

      const droppedInput = await waitFor(() => Array.from(document.querySelectorAll('.edit-modal .gist-editor-filename-area'))
        .find(input => input.value === 'dropped-logo.webp'))
      const markdownEditor = markdownRow.querySelector('.CodeMirror').CodeMirror
      const markdownReference = await waitFor(() => markdownEditor.getValue().includes('![dropped-logo](dropped-logo.webp)'))

      const dropZone = document.querySelector('.edit-modal .image-attachment-drop-zone')
      if (!dropZone) {
        return {
          base64State,
          initial,
          reason: 'missing configured image drop zone',
          restored: Boolean(restoredByRetry)
        }
      }
      const findImportedRow = filename => Array.from(document.querySelectorAll('.edit-modal .gist-editor-gist-file'))
        .find(row => row.querySelector('.gist-editor-filename-area').value === filename)
      const textContent = 'const message = "hello café"'
      const mixedTransfer = new DataTransfer()
      mixedTransfer.items.add(new File([textContent], 'imported.js', { type: 'text/javascript' }))
      mixedTransfer.items.add(new File([bytes], 'imported.webp', { type: 'image/webp' }))
      dropZone.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer: mixedTransfer
      }))
      const mixedImported = await waitFor(() => findImportedRow('imported.js') && findImportedRow('imported.webp'))
      const importedEditor = mixedImported && findImportedRow('imported.js').querySelector('.CodeMirror').CodeMirror
      const textPreserved = importedEditor && importedEditor.getValue() === textContent
      if (importedEditor) importedEditor.setValue('const edited = true')
      const textEditable = await waitFor(() => importedEditor && importedEditor.getValue() === 'const edited = true')

      const picker = dropZone.querySelector('input[type="file"]')
      const pickerTransfer = new DataTransfer()
      pickerTransfer.items.add(new File(['print(42)'], 'imported.js', { type: 'text/plain' }))
      picker.files = pickerTransfer.files
      picker.dispatchEvent(new Event('change', { bubbles: true }))
      const pickerImported = await waitFor(() => findImportedRow('imported-2.js'))
      const pickerContent = pickerImported && pickerImported.querySelector('.CodeMirror').CodeMirror.getValue()

      const binaryTransfer = new DataTransfer()
      binaryTransfer.items.add(new File([new Uint8Array([0, 1, 2])], 'archive.zip'))
      dropZone.dispatchEvent(new DragEvent('drop', {
        bubbles: true, cancelable: true, dataTransfer: binaryTransfer
      }))
      const binaryRejected = await waitFor(() => {
        const error = document.querySelector('.edit-modal .image-attachment-error')
        return error && error.textContent.includes('archive.zip') && !findImportedRow('archive.zip')
      })

      const createButton = Array.from(dropZone.querySelectorAll('button')).find(button => button.textContent === 'Create file')
      if (createButton) createButton.click()
      const blankFocused = await waitFor(() => document.activeElement.matches('.gist-editor-filename-area') && document.activeElement.value === '')
      const fileImport = {
        mixedImported: Boolean(mixedImported), textPreserved, textEditable: Boolean(textEditable),
        pickerContent, binaryRejected: Boolean(binaryRejected), blankFocused: Boolean(blankFocused)
      }

      const largeTransfer = new DataTransfer()
      largeTransfer.items.add(new File([new Uint8Array((64 * 1024) + 1)], 'too-large.png', { type: 'image/png' }))
      dropZone.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: largeTransfer
      }))
      const sizeError = await waitFor(() => {
        const error = document.querySelector('.edit-modal .image-attachment-error')
        return error && error.textContent.includes('too-large.png') && error.textContent.includes('64')
      })

      const finalImageRow = Array.from(document.querySelectorAll('.edit-modal .gist-editor-gist-file'))
        .find(row => {
          const filename = row.querySelector('.gist-editor-filename-area')
          return filename && filename.value === 'lepton-logo.webp'
        })
      const visibleImage = finalImageRow && finalImageRow.querySelector('.image-file-view')
      const finalImage = visibleImage && visibleImage.querySelector('.image-file-preview img')
      if (finalImage) finalImage.dispatchEvent(new Event('error', { bubbles: true }))
      const finalFailureVisible = await waitFor(() => visibleImage && visibleImage.querySelector('.image-file-error .image-file-retry'))
      if (visibleImage) visibleImage.scrollIntoView({ block: 'center' })

      return {
        fileImport,
        base64State,
        collapsedBeforeOpen: Boolean(collapsedBeforeOpen),
        directFailureState,
        droppedFilename: droppedInput ? droppedInput.value : null,
        externalLinkedFailure,
        finalFailureVisible: Boolean(finalFailureVisible),
        initial,
        markdownFailureState,
        markdownReference: Boolean(markdownReference),
        openedFromMarkdown: Boolean(openedFromMarkdown),
        restored: Boolean(restoredByRetry && restoredByRetry.complete && restoredByRetry.naturalWidth > 0),
        sizeError: Boolean(sizeError)
      }
    })()
  `, true)

  if (
    result.reason ||
    !result.initial.directComplete ||
    !result.initial.markdownComplete ||
    !result.initial.missingPlaceholder ||
    result.initial.missingHasOpenAction ||
    !result.initial.directSource.startsWith('data:image/webp;base64,') ||
    !result.initial.markdownSource.startsWith('data:image/webp;base64,') ||
    result.initial.renderPressed !== 'true' ||
    !result.base64State ||
    result.base64State.pressed !== 'true' ||
    result.base64State.contentLength <= 0 ||
    !result.directFailureState ||
    !result.directFailureState.hasMessage ||
    !result.directFailureState.hasRetry ||
    result.directFailureState.renderDisabled ||
    result.directFailureState.base64Disabled ||
    !result.restored ||
    !result.collapsedBeforeOpen ||
    !result.markdownFailureState ||
    !result.markdownFailureState.hasAlt ||
    !result.markdownFailureState.hasFilename ||
    !result.markdownFailureState.hasOpenAction ||
    result.markdownFailureState.insideLink ||
    !result.openedFromMarkdown ||
    !result.externalLinkedFailure ||
    !result.externalLinkedFailure.preservedLink ||
    result.externalLinkedFailure.hasOpenAction ||
    result.droppedFilename !== 'dropped-logo.webp' ||
    !result.markdownReference ||
    !result.fileImport ||
    !result.fileImport.mixedImported ||
    !result.fileImport.textPreserved ||
    !result.fileImport.textEditable ||
    result.fileImport.pickerContent !== 'print(42)' ||
    !result.fileImport.binaryRejected ||
    !result.fileImport.blankFocused ||
    !result.sizeError ||
    !result.finalFailureVisible
  ) {
    throw new Error(`Expected image attachment render/Base64 flow to work: ${JSON.stringify(result)}`)
  }
}

async function assertPythonMultilineHighlighting (window) {
  if (process.env.LEPTON_RENDER_FIXTURE !== 'python-multiline') return
  const rows = await window.webContents.executeJavaScript(`
    Array.from(document.querySelectorAll('.code-table tr')).map(row => {
      const cell = row.cells[1]
      const string = cell.querySelector('.hljs-string')
      return {
        text: cell.textContent,
        stringText: string && string.textContent,
        color: string && getComputedStyle(string).color,
        height: row.getBoundingClientRect().height,
        line: row.cells[0].getAttribute('data-pseudo-content')
      }
    })
  `)
  const stringRows = [1, 2, 3, 4, 5, 6]
  if (rows.length !== 9 ||
    rows.some((row, index) => row.line !== String(index + 1) || row.height <= 0) ||
    stringRows.some(index => rows[index].stringText === null || rows[index].color !== rows[1].color) ||
    rows[3].stringText !== '    Preserve multiline docstring highlighting.' ||
    rows[6].stringText !== "second line'''" ||
    rows[7].stringText !== null) {
    throw new Error('Multiline Python highlighting or line layout was lost: ' + JSON.stringify(rows))
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
      await applyFixtureFilterClicks(window)
      assertFixtureRendererState(await getRendererState(window))
      await assertPythonMultilineHighlighting(window)
      await assertFixtureLoginModeSwitch(window)
      await assertFixturePageFind(window)
      if (process.env.LEPTON_RENDER_FIXTURE === 'new-draft') {
        await captureScreenshot(window, 'electron-render-new-draft-before-actions.png')
      }
      await assertFixtureNewDraftRecovery(window)
      await assertFixtureImagePreferences(window)
      await assertFixtureImageAttachments(window)
      await captureScreenshot(window, `electron-render-${process.env.LEPTON_RENDER_FIXTURE}-success.png`)
      console.log(`electron render fixture smoke test passed: ${process.env.LEPTON_RENDER_FIXTURE}`)
    } else {
      await waitForLoginUi(window)
      assertLoginRendererState(await getRendererState(window))
      await assertProviderBridgeIsolation(window)
      await assertLoginProviderSwitch(window)
      if ((process.env.LEPTON_SMOKE_EXPECTED_PROVIDER || 'github') === 'github') {
        await assertLoginHeaderTooltips(window)
        await assertLoginModeSwitchKeepsModalHeight(window)
      } else {
        await captureScreenshot(window, 'electron-render-gitlab-login-success.png')
      }
      await assertLoginLocaleSwitchRendersInPlace(window)
      if (process.env.LEPTON_SMOKE_EXPECTED_PROVIDER !== 'gitlab') {
        await captureScreenshot(window, 'electron-render-smoke-success.png')
      }
      console.log('electron render smoke test passed')
      if (process.env.LEPTON_SMOKE_LOGIN_LAYOUT === '1') {
        await require('./login-layout')(window, captureScreenshot)
      }
    }

    app.exit(0)
  } catch (err) {
    await captureScreenshot(window, 'electron-render-smoke-failure.png', console.error)
    console.error(err)
    app.exit(1)
  }
}

app.whenReady().then(main)
