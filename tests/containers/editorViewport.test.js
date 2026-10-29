import { describe, expect, it } from 'vitest'
import { needsBoundedViewport } from '../../app/containers/gistEditor/viewport'

describe('editor viewport sizing', () => {
  it('keeps ordinary snippets at their natural height', () => {
    expect(needsBoundedViewport()).toBe(false)
    expect(needsBoundedViewport('const value = 42')).toBe(false)
    expect(needsBoundedViewport('x\n'.repeat(199))).toBe(false)
    expect(needsBoundedViewport('x'.repeat(20000))).toBe(false)
  })

  it('bounds both long documents and very long wrapped lines', () => {
    expect(needsBoundedViewport('x\n'.repeat(200))).toBe(true)
    expect(needsBoundedViewport('x\r\n'.repeat(200))).toBe(true)
    expect(needsBoundedViewport('x'.repeat(20001))).toBe(true)
  })
})
