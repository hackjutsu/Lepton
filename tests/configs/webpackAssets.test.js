import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const webpackConfig = require('../../webpack.config')

describe('webpack raster asset pipeline', () => {
  it('uses a file-protocol-safe public path for emitted assets', () => {
    expect(webpackConfig.output.publicPath).toBe('./bundle/')
  })

  it('cleans stale output files before emitting a new bundle', () => {
    expect(webpackConfig.output.clean).toBe(true)
  })

  it('allows profile images to opt into inline data URLs', () => {
    const inlineRule = webpackConfig.module.rules.find(rule => String(rule.resourceQuery).includes('inline'))

    expect(inlineRule).toBeDefined()
    expect(inlineRule.type).toBe('asset/inline')
  })

  it('emits large raster images instead of inlining them into the JS bundle', () => {
    const rasterRule = webpackConfig.module.rules.find(rule =>
      String(rule.test).includes('webp') &&
      rule.type === 'asset'
    )

    expect(rasterRule).toBeDefined()
    expect(rasterRule.type).toBe('asset')
    expect(rasterRule.resourceQuery.not).toEqual([/inline/])
    expect(rasterRule.parser.dataUrlCondition.maxSize).toBe(4096)
    expect(rasterRule.generator.filename).toBe('assets/[name].[contenthash][ext]')
  })
})
