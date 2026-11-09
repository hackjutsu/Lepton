const assert = require('node:assert/strict')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function verifyOverflowAccess (window, evaluate) {
  window.setContentSize(800, 577)
  window.webContents.setZoomFactor(1)
  await wait(150)
  const point = await evaluate(`(() => {
    const face = document.querySelector('.login-modal-face-front')
    const status = document.createElement('div')
    status.id = 'layout-test-status'
    status.className = 'login-status-line login-status-line-error'
    status.textContent = 'Token invalid. Please try again.'
    status.style.paddingTop = '900px'
    face.querySelector('.button-group-modal').before(status)
    face.scrollTop = 0
    const bounds = face.getBoundingClientRect()
    return { x: Math.round(bounds.left + bounds.width / 2), y: Math.round(bounds.top + bounds.height / 2) }
  })()`)

  try {
    await wait(250)
    window.webContents.sendInputEvent({ type: 'mouseWheel', ...point, deltaX: 0, deltaY: -400, canScroll: true })
    await wait(400)
    assert.ok(await evaluate("document.querySelector('.login-modal-face-front').scrollTop > 0"), 'Mouse wheel must scroll overflowing login')

    assert.ok(await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      face.scrollTop = 0
      face.focus()
      return document.activeElement === face
    })()`), 'Login must be keyboard focusable')
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'End' })
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'End' })
    await wait(400)
    assert.ok(await evaluate("document.querySelector('.login-modal-face-front').scrollTop > 0"), 'Keyboard must scroll overflowing login')

    const focused = await evaluate(`(() => {
      const face = document.querySelector('.login-modal-face-front')
      face.scrollTop = 0
      const button = face.querySelector('.button-group-modal button')
      button.blur(); button.focus()
      const r = button.getBoundingClientRect(), bounds = face.getBoundingClientRect()
      return face.scrollTop > 0 && r.top >= bounds.top - 1 && r.bottom <= bounds.bottom + 1
    })()`)
    assert.ok(focused, 'Focused control must scroll into view')
  } finally {
    await evaluate("document.getElementById('layout-test-status').remove()")
  }
}

module.exports = async function verifyLoginLayout (window, captureScreenshot) {
  const originalSize = window.getContentSize()
  const originalZoom = window.webContents.getZoomFactor()
  const evaluate = script => window.webContents.executeJavaScript(script, true)
  const provider = await evaluate("document.querySelector('.login-provider-field select').value")
  const locales = await evaluate("Array.from(document.querySelector('[data-role=language-selector]').options, option => option.value)")
  const modes = provider === 'github' ? ['oauth', 'token'] : ['token', 'invalid-host']
  let checked = 0

  try {
    await verifyOverflowAccess(window, evaluate)
    for (const mode of modes) {
      if (mode === 'token' && provider === 'github') {
        await evaluate("document.querySelector('.login-mode-switch').click()")
        await wait(750)
      }
      if (mode === 'invalid-host') {
        await evaluate(`(() => {
          const input = document.querySelector('[aria-label="GitLab instance host"]')
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ' ')
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new Event('change', { bubbles: true }))
          input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
        })()`)
        await wait(200)
        assert.equal(await evaluate("!!document.querySelector('.login-provider-error')"), true)
      }
      for (const locale of locales) {
        await evaluate(`(() => {
          const select = document.querySelector('[data-role=language-selector]')
          select.value = ${JSON.stringify(locale)}
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })()`)
        await wait(750)
        const viewports = [[800, 577, 1]]
        if (locale === 'en' || locale === 'ja') viewports.push([1180, 780, 1.25], [636, 577, 3])
        for (const [width, height, zoom] of viewports) {
          window.setContentSize(width, height)
          window.webContents.setZoomFactor(zoom)
          await wait(60)
          const result = await evaluate(`(() => {
            const face = document.querySelector('.login-modal-face-front')
            face.scrollTop = 0
            const bounds = face.getBoundingClientRect(), style = getComputedStyle(face)
            const controls = [...face.querySelectorAll('.button-group-modal button, .button-group-modal input, .button-group-modal select')]
            return {
              locale: document.querySelector('[data-role=language-selector]').value,
              top: bounds.top, bottom: bounds.bottom, height: innerHeight,
              maxHeight: style.maxHeight, scrollbarWidth: style.scrollbarWidth,
              overflow: face.scrollHeight - face.clientHeight, clientHeight: face.clientHeight,
              labelsFit: [...face.querySelectorAll('.login-provider-field span')].every(label => label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1),
              controlsFit: controls.every(control => {
                control.blur(); control.focus()
                const rect = control.getBoundingClientRect(), card = face.getBoundingClientRect()
                return rect.top >= card.top - 1 && rect.bottom <= card.bottom + 1 && rect.left >= card.left - 1 && rect.right <= card.right + 1
              })
            }
          })()`)
          const context = JSON.stringify({ provider, mode, locale, width, height, zoom, result })
          assert.equal(result.locale, locale, context)
          assert.equal(result.scrollbarWidth, 'none', context)
          assert.notEqual(result.maxHeight, 'none', context)
          assert.ok(result.top >= 22 && result.bottom <= result.height - 22, context)
          assert.ok(result.overflow <= 1 || result.clientHeight >= parseFloat(result.maxHeight) - 3, context)
          assert.ok(result.labelsFit && result.controlsFit, context)
          checked++
          if (mode === modes[0] && locale === 'ja' && zoom === 1.25) {
            await evaluate("document.querySelector('.login-modal-face-front').scrollTop = 0")
            await captureScreenshot(window, `login-layout-${provider}-japanese.png`)
          }
        }
      }
    }
    console.log(`Login layout passed: ${provider}, ${checked} representative combinations`)
  } finally {
    window.webContents.setZoomFactor(originalZoom)
    window.setContentSize(...originalSize)
  }
}
