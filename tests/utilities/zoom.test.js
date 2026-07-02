import { describe, expect, it, vi } from 'vitest'
import { applyDefaultZoomPercent, normalizeZoomPercent, zoomPercentToLevel } from '../../app/utilities/zoom'

describe('zoom utilities', () => {
  it('normalizes numeric zoom percentages', () => {
    expect(normalizeZoomPercent(100)).toBe(100)
    expect(normalizeZoomPercent(125)).toBe(125)
    expect(normalizeZoomPercent('80')).toBe(80)
  })

  it('falls back to 100 percent for invalid zoom percentages', () => {
    expect(normalizeZoomPercent('')).toBe(100)
    expect(normalizeZoomPercent('large')).toBe(100)
    expect(normalizeZoomPercent(0)).toBe(100)
    expect(normalizeZoomPercent(Number.NaN)).toBe(100)
  })

  it('converts percentages to Electron zoom levels', () => {
    expect(zoomPercentToLevel(100)).toBe(0)
    expect(zoomPercentToLevel(120)).toBeCloseTo(1)
    expect(zoomPercentToLevel(144)).toBeCloseTo(2)
  })

  it('applies the configured zoom percent to webContents', () => {
    const webContents = { setZoomLevel: vi.fn() }

    expect(applyDefaultZoomPercent({ webContents, percent: '120' })).toBe(true)

    expect(webContents.setZoomLevel).toHaveBeenCalledWith(1)
  })

  it('logs and uses the default zoom percent when config is invalid', () => {
    const webContents = { setZoomLevel: vi.fn() }
    const logger = { warn: vi.fn() }

    expect(applyDefaultZoomPercent({ webContents, percent: 'large', logger })).toBe(true)

    expect(webContents.setZoomLevel).toHaveBeenCalledWith(0)
    expect(logger.warn).toHaveBeenCalledWith('[zoom] Invalid default zoom percent "large"; using 100')
  })
})
