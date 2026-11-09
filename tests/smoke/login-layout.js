const assert = require('node:assert/strict')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = async function verifyLoginLayout (window, captureScreenshot) {
  const originalSize = window.getContentSize()
  const originalZoom = window.webContents.getZoomFactor()
  const evaluate = script => window.webContents.executeJavaScript(script, true)
  if (process.env.LEPTON_SMOKE_DEVICE_SCALE_FACTOR) {
    const expectedScale = Number(process.env.LEPTON_SMOKE_DEVICE_SCALE_FACTOR) * originalZoom
    const actualScale = await evaluate('window.devicePixelRatio')
    assert.ok(Math.abs(actualScale - expectedScale) < 0.01, `Expected device scale ${expectedScale}, got ${actualScale}`)
    console.log(`Login layout device scale: ${actualScale}`)
  }
  const provider = await evaluate("document.querySelector('.login-provider-field select').value")
  const locales = await evaluate("Array.from(document.querySelector('[data-role=language-selector]').options, option => option.value)")
  const modes = provider === 'github' ? ['oauth', 'token'] : ['token', 'invalid-host']
  let checked = 0

  try {
    window.setContentSize(800, 577)
    window.webContents.setZoomFactor(1)
    await wait(100)
    const wheelPoint = await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      const status = document.createElement('div')
      status.id = 'login-layout-wheel-status'
      status.className = 'login-status-line login-status-line-error'
      status.textContent = 'Token invalid. Please try again.'
      status.style.paddingTop = '900px'
      face.querySelector('.login-modal-body-content').append(status)
      face.scrollTop = 0
      const bounds = face.getBoundingClientRect()
      return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + bounds.height / 2) }
    })()`)
    await wait(250)
    window.webContents.sendInputEvent({ type: 'mouseWheel', ...wheelPoint, deltaX: 0, deltaY: -400, canScroll: true })
    await wait(400)
    const wheelScrolled = await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      const scrolled = face.scrollTop > 0
      document.getElementById('login-layout-wheel-status').remove()
      return scrolled
    })()`)
    assert.ok(wheelScrolled, `${provider}: overflowing login must respond to wheel scrolling`)
    const scrollRegionFocused = await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      const status = document.createElement('div')
      status.id = 'login-layout-keyboard-status'
      status.className = 'login-status-line login-status-line-error'
      status.textContent = 'Token invalid. Please try again.'
      status.style.paddingTop = '900px'
      face.querySelector('.login-modal-body-content').append(status)
      face.scrollTop = 0
      face.focus()
      return document.activeElement === face
    })()`)
    assert.ok(scrollRegionFocused, `${provider}: overflowing login must be keyboard focusable`)
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'End' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'End' })
    await wait(400)
    const keyboardScrolled = await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      const scrolled = face.scrollTop > 0
      document.getElementById('login-layout-keyboard-status').remove()
      return scrolled
    })()`)
    assert.ok(keyboardScrolled, `${provider}: overflowing login must respond to keyboard scrolling`)
    const focusedControl = await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      const group = face.querySelector('.button-group-modal')
      const message = document.createElement('div')
      message.className = 'login-status-line login-status-line-error'
      message.textContent = 'Token invalid. Please try again.'
      message.style.paddingTop = '900px'
      group.before(message)
      face.scrollTop = 0
      const button = group.querySelector('button')
      button.blur()
      button.focus()
      const rect = button.getBoundingClientRect()
      const bounds = face.getBoundingClientRect()
      const result = { scrollTop: face.scrollTop, top: rect.top, bottom: rect.bottom,
        faceTop: bounds.top, faceBottom: bounds.bottom }
      message.remove()
      return result
    })()`)
    assert.ok(focusedControl.scrollTop > 0 && focusedControl.top >= focusedControl.faceTop - 1 &&
      focusedControl.bottom <= focusedControl.faceBottom + 1, `${provider}: focus ${JSON.stringify(focusedControl)}`)
    for (const mode of modes) {
      if (mode === 'token' && provider === 'github') {
        await evaluate("document.querySelector('.login-mode-switch').click()")
        await wait(750)
      }
      for (const locale of locales) {
        await evaluate(`(() => {
          const select = document.querySelector('[data-role=language-selector]')
          select.value = ${JSON.stringify(locale)}
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })()`)
        await wait(750)
        if (mode === 'invalid-host') {
          await evaluate(`(() => {
            const input = document.querySelector('[aria-label="GitLab instance host"]')
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ' ')
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          })()`)
          await wait(100)
          await evaluate("document.querySelector('[aria-label=\"GitLab instance host\"]').dispatchEvent(new FocusEvent('focusout', { bubbles: true }))")
          await wait(100)
          assert.equal(await evaluate("!!document.querySelector('.login-provider-error')"), true)
        }
        for (const [width, height, zoom] of [[1100, 768, 1], [1180, 780, 1.25], [800, 577, 1], [800, 532, 1], [636, 577, 1], [636, 577, 1.5], [636, 577, 3]]) {
          window.setContentSize(width, height)
          window.webContents.setZoomFactor(zoom)
          await wait(60)
          const result = await evaluate(`(() => {
            const face = document.querySelector('.login-modal-face-front')
            const modal = face.closest('.modal')
            face.scrollTop = 0
            const body = face.querySelector('.login-modal-body')
            const card = face.getBoundingClientRect()
            face.scrollTop = 0
            const controls = [...face.querySelectorAll('.button-group-modal button, .button-group-modal input, .button-group-modal select')]
            const last = controls.at(-1).getBoundingClientRect()
            const bounds = body.getBoundingClientRect()
            const inputs = [...face.querySelectorAll('.button-group-modal .form-control')]
            const inputStyles = inputs.map(control => {
              const style = getComputedStyle(control)
              return [style.height, style.fontSize, style.fontWeight, style.paddingTop, style.paddingBottom, style.borderRadius].join('|')
            })
            const fields = [...face.querySelectorAll('.login-provider-field')]
            return {
              consistentInputs: inputStyles.every(style => style === inputStyles[0]),
              labelsFit: fields.every(field => {
                const label = field.querySelector('span')
                return label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1
              }),
              labelGaps: fields.map(field => {
                const label = field.querySelector('span').getBoundingClientRect()
                const input = field.querySelector('.form-control').getBoundingClientRect()
                return innerWidth > 400 ? input.left - label.right : input.top - label.bottom
              }),
              margins: [card.left, card.top, innerWidth - card.right],
              scrollbarHidden: getComputedStyle(face).scrollbarWidth === 'none',
              maxHeight: getComputedStyle(face).maxHeight,
              top: card.top,
              bottom: card.bottom,
              viewportHeight: innerHeight,
              reachability: controls.map(control => {
                control.blur()
                control.focus()
                const rect = control.getBoundingClientRect()
                const faceRect = face.getBoundingClientRect()
                return { tag: control.tagName, top: rect.top, bottom: rect.bottom, faceTop: faceRect.top, faceBottom: faceRect.bottom, height: innerHeight, scroll: face.scrollTop }
              }),
              scale: card.width / face.offsetWidth,
              overflowX: body.scrollWidth - body.clientWidth,
              overflowY: face.scrollHeight - face.clientHeight,
              faceHeight: face.clientHeight,
              contentHeight: face.scrollHeight,
              controlsPadded: controls.every(control => {
                const rect = control.getBoundingClientRect()
                return rect.left >= card.left + 14 * card.width / face.offsetWidth && rect.right <= card.right - 14 * card.width / face.offsetWidth
              }),
              bottomPadding: bounds.bottom - last.bottom,
              visibleButton: last.top >= card.top && last.bottom <= card.bottom,
              locale: document.querySelector('[data-role=language-selector]').value
            }
          })()`)
          const context = JSON.stringify({ provider, mode, locale, width, height, zoom, result })
          assert.equal(result.locale, locale, context)
          assert.ok(result.margins.every(margin => margin >= (zoom === 1 ? 23 : 0)), context)
          assert.ok(result.overflowX <= 1, context)
          assert.ok(result.scrollbarHidden, context)
          assert.notEqual(result.maxHeight, 'none', context)
          assert.ok(result.top >= 22 && result.bottom <= result.viewportHeight - 22, context)
          assert.ok(result.reachability.every(rect => rect.top >= -1 && rect.bottom <= rect.height + 1 && rect.top >= rect.faceTop - 1 && rect.bottom <= rect.faceBottom + 1), context)
          {
            assert.ok(result.overflowY <= 1 || result.faceHeight >= parseFloat(result.maxHeight) - 3, context)
            const statusLayout = await evaluate(`(() => {
              const face = document.querySelector('.login-modal-face-front')
              const status = document.createElement('div')
              status.className = 'login-status-line login-status-line-error'
              status.textContent = 'Token invalid. Please try again.'
              status.style.paddingTop = '900px'
              face.querySelector('.login-modal-body-content').append(status)
              face.scrollTop = face.scrollHeight
              const rect = status.getBoundingClientRect()
              const bounds = face.getBoundingClientRect()
              const result = { overflowing: face.scrollHeight > face.clientHeight, scrollTop: face.scrollTop, visible: rect.bottom <= bounds.bottom + 1 && rect.bottom <= innerHeight + 1 }
              status.remove()
              return result
            })()`)
            assert.ok(statusLayout.overflowing && statusLayout.scrollTop > 0 && statusLayout.visible, `${context} status: ${JSON.stringify(statusLayout)}`)
          }
          assert.ok(result.controlsPadded, context)
          assert.ok(result.bottomPadding >= 14 * result.scale - 1, context)
          assert.ok(result.visibleButton || result.overflowY > 1, context)
          assert.ok(result.consistentInputs, context)
          assert.ok(result.labelsFit, context)
          assert.ok(result.labelGaps.every(gap => gap >= 3 * result.scale - 1 && gap <= 9 * result.scale + 1), context)
          checked++
          if ((zoom === 1 && width === 636) || (zoom === 3 && locale === 'en')) {
            await evaluate("document.querySelector('.login-modal-face-front').scrollTop = 0")
            await captureScreenshot(window, `login-layout-${provider}-${mode}-${locale}-${zoom === 3 ? 'high-zoom' : 'minimum'}.png`)
          }
        }
      }
    }
    console.log(`Login layout passed: ${provider}, ${checked} locale/mode/viewport/zoom combinations`)
  } finally {
    window.webContents.setZoomFactor(originalZoom)
    window.setContentSize(...originalSize)
  }
}
