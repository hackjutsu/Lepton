const assert = require('node:assert/strict')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = async function verifyLoginLayout (window, captureScreenshot) {
  const originalSize = window.getContentSize()
  const originalZoom = window.webContents.getZoomFactor()
  const evaluate = script => window.webContents.executeJavaScript(script, true)
  const provider = await evaluate("document.querySelector('.login-provider-field select').value")
  const locales = await evaluate("Array.from(document.querySelector('[data-role=language-selector]').options, option => option.value)")
  const modes = provider === 'github' ? ['oauth', 'token'] : ['token', 'invalid-host']
  let checked = 0

  try {
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
        for (const [width, height, zoom] of [[1100, 768, 1], [636, 577, 1], [636, 577, 1.5], [636, 577, 3]]) {
          window.setContentSize(width, height)
          window.webContents.setZoomFactor(zoom)
          await wait(60)
          const result = await evaluate(`(() => {
            const face = document.querySelector('.login-modal-face-front')
            const body = face.querySelector('.login-modal-body')
            const card = face.getBoundingClientRect()
            face.scrollTop = face.scrollHeight
            const controls = [...face.querySelectorAll('.button-group-modal button, .button-group-modal input, .button-group-modal select')]
            const last = controls.at(-1).getBoundingClientRect()
            const bounds = body.getBoundingClientRect()
            return {
              margins: [card.left, card.top, innerWidth - card.right, innerHeight - card.bottom],
              overflowX: body.scrollWidth - body.clientWidth,
              controlsPadded: controls.every(control => {
                const rect = control.getBoundingClientRect()
                return rect.left >= card.left + 14 && rect.right <= card.right - 14
              }),
              bottomPadding: bounds.bottom - last.bottom,
              visibleButton: last.top >= card.top && last.bottom <= card.bottom,
              locale: document.querySelector('[data-role=language-selector]').value
            }
          })()`)
          const context = JSON.stringify({ provider, mode, locale, width, height, zoom, result })
          assert.equal(result.locale, locale, context)
          assert.ok(result.margins.every(margin => margin >= 23), context)
          assert.ok(result.overflowX <= 1, context)
          assert.ok(result.controlsPadded, context)
          assert.ok(result.bottomPadding >= 14, context)
          assert.ok(result.visibleButton, context)
          checked++
          if (locale === 'fr' && zoom === 1 && width === 636) {
            await captureScreenshot(window, `login-layout-${provider}-${mode}-minimum.png`)
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
