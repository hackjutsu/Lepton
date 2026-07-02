const DEFAULT_ZOOM_PERCENT = 100
const ELECTRON_ZOOM_STEP = 1.2

function parseZoomPercent (value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    if (trimmedValue.length === 0) {
      return null
    }

    const parsedValue = Number(trimmedValue)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
  }

  return null
}

function normalizeZoomPercent (value) {
  const zoomPercent = parseZoomPercent(value)
  return zoomPercent === null ? DEFAULT_ZOOM_PERCENT : zoomPercent
}

function zoomPercentToLevel (percent) {
  return Math.log(percent / 100) / Math.log(ELECTRON_ZOOM_STEP)
}

function applyDefaultZoomPercent ({ webContents, percent, logger }) {
  const zoomPercent = parseZoomPercent(percent)
  const normalizedZoomPercent = zoomPercent === null ? DEFAULT_ZOOM_PERCENT : zoomPercent

  if (zoomPercent === null && percent !== undefined && logger && typeof logger.warn === 'function') {
    logger.warn(`[zoom] Invalid default zoom percent ${JSON.stringify(percent)}; using ${DEFAULT_ZOOM_PERCENT}`)
  }

  if (!webContents || typeof webContents.setZoomLevel !== 'function') {
    return false
  }

  webContents.setZoomLevel(zoomPercentToLevel(normalizedZoomPercent))
  return true
}

module.exports = {
  DEFAULT_ZOOM_PERCENT,
  normalizeZoomPercent,
  zoomPercentToLevel,
  applyDefaultZoomPercent
}
