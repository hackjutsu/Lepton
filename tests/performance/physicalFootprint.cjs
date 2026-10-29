const { spawnSync } = require('child_process')

// macOS's footprint tool accounts for memory not visible in resident-set sums,
// including GPU allocations. Other platforms can still use working-set data.
module.exports = function physicalFootprint (metrics) {
  if (process.platform !== 'darwin') return null
  const args = ['--noCategories', '-f', 'bytes', ...metrics.flatMap(metric => ['-p', String(metric.pid)])]
  const result = spawnSync('/usr/bin/footprint', args, { encoding: 'utf8', timeout: 10000 })
  if (result.error || result.status !== 0) return null
  const match = result.stdout.match(/Summary Footprint:\s*(\d+)\s*B/)
  return match ? Number(match[1]) : null
}
