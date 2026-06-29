const ELEMENT_NODE = 1
const COMMENT_NODE = 8

const VOID_TAGS = new Set([
  'br',
  'col',
  'hr',
  'img',
  'input'
])

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
  'var'
])

const DROP_CONTENT_TAGS = new Set([
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'textarea'
])

const GLOBAL_ATTRIBUTES = new Set([
  'class',
  'dir',
  'id',
  'lang',
  'title'
])

const TAG_ATTRIBUTES = {
  a: new Set(['href']),
  blockquote: new Set(['cite']),
  col: new Set(['span', 'width']),
  colgroup: new Set(['span', 'width']),
  del: new Set(['cite', 'datetime']),
  details: new Set(['open']),
  img: new Set(['alt', 'height', 'src', 'width']),
  input: new Set(['checked', 'disabled', 'type']),
  ins: new Set(['cite', 'datetime']),
  li: new Set(['value']),
  ol: new Set(['start', 'type']),
  q: new Set(['cite']),
  td: new Set(['align', 'colspan', 'rowspan']),
  th: new Set(['align', 'colspan', 'rowspan'])
}

const URL_ATTRIBUTES = new Set([
  'cite',
  'href',
  'src'
])

const SAFE_PROTOCOLS = new Set([
  'http',
  'https',
  'mailto',
  'tel'
])

function escapeHtml (html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttribute (value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
}

function removeNode (node) {
  node.parentNode && node.parentNode.removeChild(node)
}

function unwrapNode (node) {
  const parent = node.parentNode
  if (!parent) return

  while (node.firstChild) {
    parent.insertBefore(node.firstChild, node)
  }
  parent.removeChild(node)
}

function isAllowedAttribute (tagName, attributeName) {
  return GLOBAL_ATTRIBUTES.has(attributeName) ||
    (TAG_ATTRIBUTES[tagName] && TAG_ATTRIBUTES[tagName].has(attributeName))
}

function removeUnsafeUrlCharacters (url) {
  let normalized = ''
  for (let idx = 0; idx < url.length; idx++) {
    const char = url[idx]
    const charCode = char.charCodeAt(0)
    if (charCode > 31 && charCode !== 127 && char.trim() !== '') {
      normalized += char
    }
  }
  return normalized
}

function isSafeUrl (url) {
  const normalized = removeUnsafeUrlCharacters(url.trim()).toLowerCase()
  if (!normalized || normalized.startsWith('#')) return true

  const protocolMatch = normalized.match(/^([a-z0-9.+-]+):/)
  return !protocolMatch || SAFE_PROTOCOLS.has(protocolMatch[1])
}

function sanitizeAttributes (element, tagName) {
  Array.from(element.attributes).forEach(attribute => {
    const attributeName = attribute.name.toLowerCase()

    if (
      attributeName.startsWith('on') ||
      attributeName === 'style' ||
      attributeName === 'srcdoc' ||
      !isAllowedAttribute(tagName, attributeName) ||
      (URL_ATTRIBUTES.has(attributeName) && !isSafeUrl(attribute.value))
    ) {
      element.removeAttribute(attribute.name)
    }
  })

  if (tagName === 'input') {
    if (element.getAttribute('type') !== 'checkbox') {
      element.setAttribute('type', 'checkbox')
    }
    element.setAttribute('disabled', '')
  }
}

function sanitizeNode (node) {
  Array.from(node.childNodes).forEach(child => {
    if (child.nodeType === COMMENT_NODE) {
      removeNode(child)
      return
    }

    if (child.nodeType !== ELEMENT_NODE) return

    const tagName = child.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tagName)) {
      if (DROP_CONTENT_TAGS.has(tagName)) {
        removeNode(child)
      } else {
        sanitizeNode(child)
        unwrapNode(child)
      }
      return
    }

    sanitizeAttributes(child, tagName)
    sanitizeNode(child)
  })
}

function openingTagForElement (element, tagName) {
  const attributes = Array.from(element.attributes)
    .map(attribute => {
      if (attribute.value === '') return ` ${attribute.name}`
      return ` ${attribute.name}="${escapeAttribute(attribute.value)}"`
    })
    .join('')

  return `<${tagName}${attributes}>`
}

export function sanitizeInlineHtml (html) {
  const closingTag = html.match(/^<\/\s*([A-Za-z][A-Za-z0-9-]*)\s*>$/)
  if (closingTag) {
    const tagName = closingTag[1].toLowerCase()
    return ALLOWED_TAGS.has(tagName) && !VOID_TAGS.has(tagName) ? `</${tagName}>` : ''
  }

  const openingTag = html.match(/^<\s*([A-Za-z][A-Za-z0-9-]*)([\s\S]*?)\/?\s*>$/)
  if (!openingTag) return escapeHtml(html)

  const tagName = openingTag[1].toLowerCase()
  if (!ALLOWED_TAGS.has(tagName)) return ''

  if (typeof document === 'undefined' || !document.createElement) {
    return escapeHtml(html)
  }

  const template = document.createElement('template')
  template.innerHTML = `<${tagName}${openingTag[2]}></${tagName}>`
  sanitizeNode(template.content)

  const element = template.content.firstElementChild
  return element ? openingTagForElement(element, tagName) : ''
}

export default function sanitizeHtml (html) {
  if (typeof document === 'undefined' || !document.createElement) {
    return escapeHtml(html)
  }

  const template = document.createElement('template')
  template.innerHTML = html
  sanitizeNode(template.content)
  return template.innerHTML
}
