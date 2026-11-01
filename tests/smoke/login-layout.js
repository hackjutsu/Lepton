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
        for (const [width, height, zoom] of [[1100, 768, 1], [800, 532, 1], [636, 577, 1], [636, 577, 1.5], [636, 577, 3]]) {
          window.setContentSize(width, height)
          window.webContents.setZoomFactor(zoom)
          await wait(60)
          const result = await evaluate(`(() => {
            const face = document.querySelector('.login-modal-face-front')
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
              margins: [card.left, card.top, innerWidth - card.right, innerHeight - card.bottom],
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
          {
            assert.ok(result.overflowY <= 1, context)
            const statusLayout = await evaluate(`(() => {
              const face = document.querySelector('.login-modal-face-front')
              const status = document.createElement('div')
              status.className = 'login-status-line login-status-line-error'
              status.textContent = 'Token invalid. Please try again.'
              face.querySelector('.login-modal-body-content').append(status)
              const rect = status.getBoundingClientRect()
              const bounds = face.getBoundingClientRect()
              const result = { overflowY: face.scrollHeight - face.clientHeight, visible: rect.bottom <= bounds.bottom && rect.bottom <= innerHeight && bounds.top >= 0 }
              status.remove()
              return result
            })()`)
            assert.ok(statusLayout.overflowY <= 1 && statusLayout.visible, `${context} status: ${JSON.stringify(statusLayout)}`)
          }
          assert.ok(result.controlsPadded, context)
          assert.ok(result.bottomPadding >= 14 * result.scale - 1, context)
          assert.ok(result.visibleButton, context)
          assert.ok(result.consistentInputs, context)
          assert.ok(result.labelsFit, context)
          assert.ok(result.labelGaps.every(gap => gap >= 3 * result.scale - 1 && gap <= 9 * result.scale + 1), context)
          checked++
          if ((zoom === 1 && width === 636) || (zoom === 3 && locale === 'en')) {
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
