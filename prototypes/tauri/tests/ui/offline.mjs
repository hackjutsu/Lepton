import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-offline-ui-'))
let gist = { id: 'abc123', description: '[Offline fixture] #test', public: false, html_url: 'https://example.test/abc123', updated_at: '2026-01-01T00:00:00Z', files: { 'note.txt': { filename: 'note.txt', language: 'Text', content: 'before sync' }, 'tasks.md': { filename: 'tasks.md', language: 'Markdown', content: '# Tasks\n\n- [ ] first task\n' } } }
const incomplete = { id: 'abc124', description: '[Large fixture] #test', public: false, html_url: 'https://example.test/abc124', updated_at: '2026-01-01T00:00:00Z', truncated: true, files: { 'first.txt': { filename: 'first.txt', language: 'Text' } } }
const detailRequests = []
const brief = value => ({ ...value, files: Object.fromEntries(Object.entries(value.files).map(([name, file]) => [name, Object.fromEntries(Object.entries(file).filter(([key]) => key !== 'content'))])) })
const server = http.createServer((req, res) => {
  if (req.url === '/avatar.png') {
    const image = fs.readFileSync(path.resolve('../../build/icon/icon.png'))
    setTimeout(() => { res.writeHead(200, { 'content-type': 'image/png', 'content-length': image.length }); res.end(image) }, 300)
    return
  }
  if (req.headers.authorization !== 'Bearer ui-test-token') { res.writeHead(401); res.end(); return }
  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    let output
    if (req.method === 'GET' && req.url === '/api/v3/user') output = { login: 'fixture-user', html_url: 'https://example.test/user', avatar_url: `${base}/avatar.png` }
    else if (req.method === 'GET' && req.url.startsWith('/api/v3/gists?')) output = [brief(gist), brief(incomplete)]
    else if (req.method === 'GET' && req.url === '/api/v3/gists/abc123') { detailRequests.push('abc123'); output = gist }
    else if (req.method === 'GET' && req.url === '/api/v3/gists/abc124') { detailRequests.push('abc124'); output = incomplete }
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
    const send = () => { res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }); res.end(JSON.stringify(output)) }
    if (req.url === '/api/v3/user') setTimeout(send, 1000)
    else send()
  })
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
fs.writeFileSync(path.join(directory, '.leptonrc'), JSON.stringify({ enterprise: { enable: true, host: base, avatarUrl: `${base}/avatar.png` }, provider: { type: 'github' } }))
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
  const loginLayout = await run('const face=document.querySelector(".login-modal-face-front"); const status=face.querySelector(".login-status-line-error").getBoundingClientRect(); const bounds=face.getBoundingClientRect(); return {overflow:face.scrollHeight-face.clientHeight, scrollTop:face.scrollTop, statusVisible:status.top>=bounds.top && status.bottom<=bounds.bottom}')
  assert.ok(loginLayout.overflow <= 1 && loginLayout.scrollTop === 0 && loginLayout.statusVisible, `Login error must be visible without scrolling: ${JSON.stringify(loginLayout)}`)
  assert.equal(await run('return !!document.querySelector(".login-status-line-error a")'), false, 'Invalid token should not show a log link')
  const loginHeight = await run('return document.querySelector(".login-modal-card").getBoundingClientRect().height')
  await run('const e=document.querySelector(".login-modal-face-front form input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"ui-test-token"); e.dispatchEvent(new Event("input",{bubbles:true})); document.querySelector(".login-modal-face-front form").requestSubmit(); return true')
  await waitFor('return !!document.querySelector(".login-modal-loading .progress")', 'login loading state')
  const loadingLayout = await run('const face=document.querySelector(".login-modal-face-front"); return {height:document.querySelector(".login-modal-card").getBoundingClientRect().height, overflow:face.scrollHeight-face.clientHeight}')
  assert.ok(Math.abs(loadingLayout.height - loginHeight) <= 1 && loadingLayout.overflow <= 1, `Login card moved or clipped while loading: ${JSON.stringify({ loginHeight, loadingLayout })}`)
  if (process.env.LEPTON_UI_LOADING_SCREENSHOT) {
    const screenshot = await request(`/session/${session}/screenshot`)
    fs.writeFileSync(process.env.LEPTON_UI_LOADING_SCREENSHOT, Buffer.from(screenshot, 'base64'))
  }
  await waitFor('return document.querySelector(".snippet-box")?.innerText.includes("Offline fixture")', 'mock GitHub account')
  await waitFor('const image=document.querySelector(".profile-image-section"); return image?.complete && image.naturalWidth>0 && image.src.endsWith("/avatar.png")', 'remote profile image')
  const sidebar = await run('return [...document.querySelectorAll(".user-panel-button")].map(button=>{const icon=button.querySelector("svg").getBoundingClientRect(); const label=button.querySelector("span").getBoundingClientRect(); const avatar=document.querySelector(".profile-image-section").getBoundingClientRect(); return {iconTop:icon.top, iconBottom:icon.bottom, labelTop:label.top, labelBottom:label.bottom, avatarBottom:avatar.bottom}})')
  assert.ok(sidebar.every(item => item.iconTop >= item.avatarBottom - 1 && item.iconBottom > item.labelTop && item.iconTop < item.labelBottom), `Sidebar icons must stay beside their labels below the avatar: ${JSON.stringify(sidebar)}`)
  assert.deepEqual(detailRequests, ['abc123'], 'Default sync should fetch only the selected snippet')
  await run('[...document.querySelectorAll(".snippet-thumnail-list-item")].find(e=>e.innerText.includes("Large fixture")).querySelector("div").click(); return true')
  await waitFor('return document.querySelector(".snippet-box [role=status]")?.innerText.includes("cannot be displayed or edited safely")', 'incomplete snippet warning')
  assert.deepEqual(detailRequests, ['abc123', 'abc124'], 'Selecting an uncached snippet should fetch its details')
  assert.equal(await run('return !!document.querySelector(".header-controls [title=Edit]")'), false)
  await run('window.lepton.ipc.emit("edit-gist-renderer"); return true')
  assert.equal(await run('return !!document.querySelector(".gist-editor-form")'), false, 'An incomplete snippet must not be editable')
  await run('[...document.querySelectorAll(".snippet-thumnail-list-item")].find(e=>e.innerText.includes("Offline fixture")).querySelector("div").click(); return true')
  await waitFor('return document.querySelector(".snippet-box")?.innerText.includes("Offline fixture")', 'return to complete snippet')
  await run('window.__downloadAllSaved=false; window.lepton.config.set("snippet:downloadAll",true).then(()=>{window.__downloadAllSaved=true}); return true')
  await waitFor('return window.__downloadAllSaved===true', 'download-all preference')
  await run('window.lepton.ipc.emit("sync-gists"); return true')
  for (let n = 0; n < 100 && detailRequests.filter(id => id === 'abc124').length < 2; n++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(detailRequests.filter(id => id === 'abc124').length, 2, 'Download-all sync should fetch details for every snippet')
  await waitFor('return !!document.querySelector(".snippet-box .task-list-item-checkbox")', 'download-all sync completes')
  const metadata = path.join(directory, 'remote-account.json')
  for (let n = 0; n < 100 && !fs.existsSync(metadata); n++) await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(fs.existsSync(metadata))
  assert.equal(fs.readFileSync(metadata, 'utf8').includes('ui-test-token'), false)
  await run('window.__storageReady=false; window.lepton.config.set("security:cachedAccessTokenStorage","file").then(()=>window.__TAURI_INTERNALS__.invoke("restore_remote_account")).then(value=>{window.__storageReady=value?.token==="ui-test-token"}); return true')
  await waitFor('return window.__storageReady===true', 'file credential mode')
  assert.equal(fs.readdirSync(path.join(directory, 'credentials')).length, 1, 'File mode should store the account credential in the isolated directory')
  await run('window.__storageReady=false; window.lepton.config.set("security:cachedAccessTokenStorage","encrypted").then(()=>window.__TAURI_INTERNALS__.invoke("restore_remote_account")).then(value=>{window.__storageReady=value?.token==="ui-test-token"}); return true')
  await waitFor('return window.__storageReady===true', 'encrypted credential mode')
  assert.equal(fs.readdirSync(path.join(directory, 'credentials')).length, 0, 'Switching back to encrypted storage should remove the plaintext credential')
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
