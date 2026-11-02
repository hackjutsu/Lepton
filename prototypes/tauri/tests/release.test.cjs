const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { resolveRelease } = require('../scripts/release-context.cjs')
const { stageArtifacts } = require('../scripts/stage-release.cjs')

test('release modes keep Rust tags and Electron tags separate', () => {
  const base = { event: 'workflow_dispatch', refType: 'branch', refName: 'master', releaseRef: '', publish: 'never', version: '0.1.0' }
  assert.deepEqual(resolveRelease(base), { publish: 'never', tag: '' })
  assert.deepEqual(resolveRelease({ ...base, releaseRef: 'refs/tags/rust-v0.1.0', publish: 'draft' }), { publish: 'draft', tag: 'rust-v0.1.0' })
  assert.deepEqual(resolveRelease({ ...base, event: 'push', refType: 'tag', refName: 'rust-v0.1.0' }), { publish: 'prerelease', tag: 'rust-v0.1.0' })
  for (const releaseRef of ['', 'v0.1.0', 'rust-v0.2.0', 'rust-v0.1.0;bad']) {
    assert.throws(() => resolveRelease({ ...base, releaseRef, publish: 'draft' }))
  }
  assert.throws(() => resolveRelease({ ...base, event: 'push', refType: 'branch' }))
  assert.throws(() => resolveRelease({ ...base, publish: 'release' }))
})

test('staging requires exactly one installer for each target and keeps names distinct', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-rust-release-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const bundle = path.join(root, 'bundle')
  const output = path.join(root, 'out')
  for (const [dir, name] of [['dmg', 'app.dmg'], ['nsis', 'app.exe'], ['deb', 'app.deb'], ['appimage', 'app.AppImage']]) {
    fs.mkdirSync(path.join(bundle, dir), { recursive: true })
    fs.writeFileSync(path.join(bundle, dir, name), `${dir}-fixture`)
  }
  for (const target of ['macos-arm64', 'macos-x64', 'windows-x64', 'linux-x64']) stageArtifacts(target, bundle, output)
  const names = fs.readdirSync(output)
  assert.equal(names.length, 5)
  assert.ok(names.includes('lepton-rust-macos-arm64-app.dmg'))
  assert.ok(names.includes('lepton-rust-macos-x64-app.dmg'))
  assert.throws(() => stageArtifacts('linux-x64', bundle, output))
  assert.throws(() => stageArtifacts('unknown', bundle, path.join(root, 'unknown')))
  fs.writeFileSync(path.join(bundle, 'deb', 'other.deb'), 'duplicate')
  assert.throws(() => stageArtifacts('linux-x64', bundle, path.join(root, 'duplicate')), /Expected one/)
})
