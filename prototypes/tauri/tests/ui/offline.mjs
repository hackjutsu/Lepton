import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-offline-ui-'))
let gist = { id: 'abc123', description: '[Offline fixture] #test', public: false, html_url: 'https://example.test/abc123', updated_at: '2026-01-01T00:00:00Z', files: { 'note.txt': { filename: 'note.txt', language: 'Text', content: 'before sync' }, 'tasks.md': { filename: 'tasks.md', language: 'Markdown', content: '# Tasks\n\n- [ ] first task\n' } } }
const server = http.createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer ui-test-token') { res.writeHead(401); res.end(); return }
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    let output
    if (req.method === 'GET' && req.url === '/api/v3/user') output = { login: 'fixture-user', html_url: 'https://example.test/user' }
    else if (req.method === 'GET' && req.url.startsWith('/api/v3/gists?')) output = [gist]
    else if (req.method === 'GET' && req.url === '/api/v3/gists/abc123') output = gist
    else if (req.method === 'PATCH' && req.url === '/api/v3/gists/abc123') {
      const patch = JSON.parse(body)
      const files = { ...gist.files }
      for (const [name, file] of Object.entries(patch.files)) {
        if (file === null) delete files[name]
        else files[name] = { ...files[name], filename: name, content: file.content }
      }
      gist = { ...gist, description: patch.description, files }
      output = gist
    } else { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify(output))
  })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
fs.writeFileSync(path.join(directory, '.leptonrc'), JSON.stringify({ enterprise: { enable: true, host: base }, provider: { type: 'github' } }))
const listener = net.createServer()
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise(resolve => listener.close(resolve))
const binary = path.resolve('src-tauri/target/debug', process.platform === 'win32' ? 'lepton-rust-prototype.exe' : 'lepton-rust-prototype')
const env = { ...process.env, XDG_CONFIG_HOME: directory, LEPTON_UI_TESTS: '1', LEPTON_PROTOTYPE_DATA_DIR: directory, TAURI_WEBDRIVER_PORT: String(port) }
for (const key of ['LEPTON_GITHUB_OAUTH_CLIENT_ID', 'LEPTON_GITHUB_OAUTH_CLIENT_SECRET', 'LEPTON_GITHUB_TOKEN_FILE', 'LEPTON_TEST_GITHUB_TOKEN', 'LEPTON_TEST_GITLAB_TOKEN']) delete env[key]
const app = spawn(binary, [], { env, stdio: ['ignore', 'ignore', 'pipe'] })
let output = ''
app.stderr.on('data', chunk => { output += chunk.toString() })
const origin = `http://127.0.0.1:${port}`
async function request (route, body) {
  const response = await fetch(origin + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) })
  const result = await response.json()
  if (!response.ok || result.value?.error) throw new Error(`WebDriver request failed: ${result.value?.message || response.status}`)
  return result.value
}
let session
async function run (script, ...args) { return request(`/session/${session}/execute/sync`, { script, args }) }
async function waitFor (script, description) {
  for (let n = 0; n < 300; n++) {
    if (await run(script)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${description}`)
}
try {
  let ready = false
  for (let n = 0; n < 150; n++) {
    if (app.exitCode !== null) throw new Error(`Test app exited before startup: ${output}`)
    try { await request('/status'); ready = true; break } catch { await new Promise(resolve => setTimeout(resolve, 200)) }
  }
  if (!ready) throw new Error('Test WebDriver did not start')
  session = (await request('/session', { capabilities: { alwaysMatch: {} } })).sessionId
  await waitFor('return !!document.querySelector(".active-layout .snippet-box")', 'local library')
  await run('[...document.querySelectorAll(".user-panel-button")].find(e=>e.innerText.trim().toLowerCase()==="logout").click(); return true')
  await waitFor('return !!document.querySelector(".logout-modal .btn-danger")', 'logout confirmation')
  await run('document.querySelector(".logout-modal .btn-danger").click(); return true')
  await waitFor('return !!document.querySelector(".login-modal-face-front form input")', 'enterprise token login')
  await run('const e=document.querySelector(".login-modal-face-front form input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"bad-test-token"); e.dispatchEvent(new Event("input",{bubbles:true})); document.querySelector(".login-modal-face-front form").requestSubmit(); return true')
  await waitFor('return document.querySelector(".login-status-line-error")?.innerText.includes("Token invalid. Please try again.")', 'invalid token feedback')
  assert.equal(await run('return !!document.querySelector(".login-status-line-error a")'), false, 'Invalid token should not show a log link')
  await run('const e=document.querySelector(".login-modal-face-front form input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"ui-test-token"); e.dispatchEvent(new Event("input",{bubbles:true})); document.querySelector(".login-modal-face-front form").requestSubmit(); return true')
  await waitFor('return document.querySelector(".snippet-box")?.innerText.includes("Offline fixture")', 'mock GitHub account')
  const metadata = path.join(directory, 'remote-account.json')
  for (let n = 0; n < 100 && !fs.existsSync(metadata); n++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(fs.existsSync(metadata))
  assert.equal(fs.readFileSync(metadata, 'utf8').includes('ui-test-token'), false)
  // Exercise the same bridge used by the editor, including the cache update.
  await run('window.__saveResult="pending"; window.lepton.snippets.request(null,"EDIT_SINGLE_GIST",["provider-session","abc123","[Offline fixture] #test",{"note.txt":{"content":"updated online"}}]).then(()=>{window.__saveResult="ok"},()=>{window.__saveResult="failed"}); return true')
  await waitFor('return window.__saveResult!=="pending"', 'remote edit')
  assert.equal(await run('return window.__saveResult'), 'ok')
  await waitFor('return !!document.querySelector(".task-list-item-checkbox")', 'Markdown task checkbox')
  await run('document.querySelector(".task-list-item-checkbox").click(); return true')
  for (let n = 0; n < 100 && !gist.files['tasks.md'].content.includes('[x]'); n++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.match(gist.files['tasks.md'].content, /\[x\]/i, 'Markdown task toggle should save remotely')
  await waitFor('return document.querySelector(".task-list-item-checkbox")?.checked===true && !document.querySelector(".task-list-item-checkbox")?.disabled', 'saved Markdown task')
  assert.equal(fs.readFileSync(path.join(directory, 'snippets.sqlite3')).includes(Buffer.from('ui-test-token')), false)
  await new Promise(resolve => server.close(resolve))
  await run('window.__reloadMarker=true; return true')
  await request(`/session/${session}/refresh`, {})
  await waitFor('return !window.__reloadMarker && document.querySelector(".snippet-box")?.innerText.includes("updated online")', 'cached offline snippet')
  await waitFor('return document.querySelector(".task-list-item-checkbox")?.checked===true', 'cached Markdown task')
  await waitFor('return document.querySelector(".customized-tag-small")?.innerText.includes("Offline")', 'offline indicator')
  console.log('PASS: invalid token feedback, remembered account, edit and Markdown task cache, and offline startup')
} finally {
  if (server.listening) await new Promise(resolve => server.close(resolve))
  app.kill()
  await new Promise(resolve => { if (app.exitCode !== null) resolve(); else app.once('exit', resolve); setTimeout(resolve, 3000) })
  fs.rmSync(directory, { recursive: true, force: true })
}
