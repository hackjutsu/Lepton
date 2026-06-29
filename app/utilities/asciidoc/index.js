import Asciidoctor from '@asciidoctor/core'

const asciidoctor = Asciidoctor()
const blockedTagNames = new Set([
  'applet',
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'math',
  'meta',
  'object',
  'option',
  'script',
  'select',
  'style',
  'svg',
  'textarea'
])
const urlAttributeNames = new Set([
  'action',
  'formaction',
  'href',
  'src',
  'xlink:href'
])
const safeUrlProtocols = new Set([
  'http:',
  'https:',
  'mailto:'
])

function isSafeUrl (value) {
  const trimmedValue = value.trim()
  if (trimmedValue.startsWith('#') || !/^[a-z][a-z0-9+.-]*:/i.test(trimmedValue)) {
    return true
  }

  try {
    return safeUrlProtocols.has(new URL(trimmedValue).protocol)
  } catch (err) {
    return false
  }
}

function sanitizeHtml (html) {
  if (typeof document === 'undefined') return html

  const template = document.createElement('template')
  template.innerHTML = html

  Array.from(template.content.querySelectorAll('*')).forEach(node => {
    const tagName = node.tagName.toLowerCase()
    if (blockedTagNames.has(tagName)) {
      node.parentNode && node.parentNode.removeChild(node)
      return
    }

    Array.from(node.attributes).forEach(attribute => {
      const attributeName = attribute.name.toLowerCase()
      if (
        attributeName.startsWith('on') ||
        attributeName === 'style' ||
        attributeName === 'srcdoc' ||
        (urlAttributeNames.has(attributeName) && !isSafeUrl(attribute.value))
      ) {
        node.removeAttribute(attribute.name)
      }
    })
  })

  return template.innerHTML
}

const AsciiDoc = {
  render (content) {
    const renderedHtml = asciidoctor.convert(content || '', {
      safe: 'secure',
      attributes: {
        showtitle: true,
        'source-highlighter': 'highlight.js'
      }
    })
    return sanitizeHtml(renderedHtml)
  }
}

export default AsciiDoc
