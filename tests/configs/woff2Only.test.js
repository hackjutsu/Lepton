import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const woff2Only = require('../../configs/loaders/woff2Only')

describe('Electron font assets', () => {
  it('handles unquoted format names emitted by production Sass', () => {
    expect(woff2Only('@font-face{src:url(math.woff2) format(woff2),url(math.ttf) format(truetype)}'))
      .toBe('@font-face{src: url(math.woff2) format(woff2);}')
  })

  it('keeps WOFF2 and removes legacy sources without changing font descriptors', () => {
    const css = `@font-face {
      font-family: Icons;
      src: url('icons.eot');
      src: url('icons.eot?#iefix') format('embedded-opentype'), url('icons.woff2') format('woff2'), url('icons.ttf') format('truetype');
      font-weight: normal;
    }`
    const result = woff2Only(css)
    expect(result).toContain("src: url('icons.woff2') format('woff2');")
    expect(result).not.toMatch(/\.eot|\.ttf/)
    expect(result).toContain('font-family: Icons;')
    expect(result).toContain('font-weight: normal;')
  })

  it('preserves other faces and non-font URLs', () => {
    const fallback = '@font-face { font-family: Other; src: url(other.woff) format("woff"); }'
    const image = '.logo { background: url(logo.png); }'
    const modern = '@font-face{font-family:Math;src:url(math.woff2) format("woff2"),url(math.woff) format("woff");font-style:italic;}'
    const result = woff2Only(fallback + image + modern)
    expect(result).toContain(fallback + image)
    expect(result).toContain('src: url(math.woff2) format("woff2");')
    expect(result).not.toContain('url(math.woff)')
    expect(result).toContain('font-style:italic;')
  })
})
