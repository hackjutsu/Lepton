import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-tauri-ui-'))
const listener = net.createServer()
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
const port = listener.address().port
await new Promise(resolve => listener.close(resolve))
const binary = path.resolve('src-tauri/target/debug', process.platform === 'win32' ? 'lepton-rust-prototype.exe' : 'lepton-rust-prototype')
if (!fs.existsSync(binary)) {
  fs.rmSync(directory, { recursive: true, force: true })
  throw new Error('Missing Tauri UI test binary. Run npm run test:ui:build first.')
}
const testEnv = { ...process.env, XDG_CONFIG_HOME: directory, LEPTON_UI_TESTS: '1', LEPTON_PROTOTYPE_DATA_DIR: directory, TAURI_WEBDRIVER_PORT: String(port) }
for (const key of ['LEPTON_GITHUB_OAUTH_CLIENT_ID', 'LEPTON_GITHUB_OAUTH_CLIENT_SECRET', 'LEPTON_GITHUB_TOKEN_FILE', 'LEPTON_TEST_GITHUB_TOKEN', 'LEPTON_TEST_GITLAB_TOKEN']) delete testEnv[key]
const app = spawn(binary, [], { env: testEnv, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
app.on('error', error => { output += error.message })
app.stdout.on('data', data => { output += data.toString() })
app.stderr.on('data', data => { output += data.toString() })
const url = `http://127.0.0.1:${port}`
async function request (route, body) {
  const response = await fetch(url + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) })
  const result = await response.json()
  if (!response.ok || result.value?.error) throw new Error(`WebDriver ${route}: ${result.value?.message || response.status}`)
  return result.value
}
let session
async function run (script, ...args) { return request(`/session/${session}/execute/sync`, { script, args }) }
async function waitFor (script, description) {
  for (let n = 0; n < 100; n++) {
    if (await run(script)) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${description}`)
}
async function click (selector) { assert.equal(await run('const e=document.querySelector(arguments[0]); if (!e) return false; e.click(); return true', selector), true, `Missing ${selector}`) }
async function emit (channel) { await run('window.lepton.ipc.emit(arguments[0]); return true', channel) }
async function expectElement (selector, text = '') {
  for (let n = 0; n < 100; n++) {
    const result = await run('const e=document.querySelector(arguments[0]); return !!e && (!arguments[1] || e.innerText.includes(arguments[1]))', selector, text)
    if (result) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${selector}: ${text}`)
}
async function absent (selector) { await waitFor(`return !document.querySelector(${JSON.stringify(selector)})`, `closing ${selector}`) }
async function closeModal (selector) { await click(`${selector} .modal-header .close`); await absent(selector) }
async function selectSnippet (title) {
  const selected = await run('const e=[...document.querySelectorAll(".snippet-thumnail-list-item")].find(x=>x.innerText.includes(arguments[0])); if(!e) return false; e.querySelector("div").click(); return true', title)
  assert.equal(selected, true, `Missing snippet ${title}`)
  await expectElement('.snippet-box', title)
}
async function check (name, fn) { await fn(); console.log(`PASS: ${name}`) }
try {
  let ready = false
  for (let n = 0; n < 150; n++) {
    if (app.exitCode !== null) throw new Error(`Tauri test app exited before startup: ${output}`)
    try { await request('/status'); ready = true; break } catch { await new Promise(resolve => setTimeout(resolve, 200)) }
  }
  if (!ready) throw new Error(`WebDriver did not start: ${output}`)
  session = (await request('/session', { capabilities: { alwaysMatch: {} } })).sessionId
  await expectElement('.active-layout .snippet-box', 'React 19 render fixture')
  await run('window.__smokeErrors=[]; window.addEventListener("error", e=>window.__smokeErrors.push(e.message)); window.addEventListener("unhandledrejection", e=>window.__smokeErrors.push(String(e.reason))); return true')
  await check('active layout, local avatar, image and Markdown', async () => {
    const info = await run('const box=document.querySelector(".active-layout").getBoundingClientRect(); const avatar=document.querySelector(".profile-image-section"); const image=document.querySelector(".image-file-view img"); return {width:box.width,height:box.height,avatar:avatar?.naturalWidth,image:image?.naturalWidth,text:document.body.innerText}')
    assert.ok(info.width > 0 && info.height > 0 && info.avatar > 0 && info.image > 0)
    assert.match(info.text, /exercises markdown rendering/)
    assert.deepEqual(await run('return [...document.querySelectorAll("[data-gist-filename]")].map(e=>e.dataset.gistFilename)'), ['hello.js', 'notes.md', 'lepton-logo.webp', 'styles.css'])
    assert.equal(await run('const e=document.querySelector(".starred-tag-section"); return !!e && getComputedStyle(e).display!=="none"'), false, 'Local library should not show a GitHub starred link')
  })
  const screenshot = await request(`/session/${session}/screenshot`)
  const artifact = process.env.LEPTON_UI_SCREENSHOT || path.join(directory, 'active.png')
  fs.writeFileSync(artifact, Buffer.from(screenshot, 'base64'))
  console.log(`Screenshot: ${artifact}`)
  await check('new editor', async () => { await emit('new-gist-renderer'); await expectElement('.modal .gist-editor-form .CodeMirror'); await emit('exit-editor'); await absent('.modal .gist-editor-form') })
  await check('edit editor', async () => { await emit('edit-gist-renderer'); await expectElement('.modal .gist-editor-form .CodeMirror'); await emit('exit-editor'); await absent('.modal .gist-editor-form') })
  await check('about and settings paths', async () => {
    await emit('about-page'); await expectElement('.about-modal .modal-title', 'Settings')
    await run('[...document.querySelectorAll(".settings-tabs button")].find(e=>e.textContent.trim()==="About").click(); return true')
    await expectElement('.about-section', 'Configurations')
    const paths = await run('return window.lepton.globals.getPaths()')
    assert.equal(paths.configFilePath, path.join(directory, '.leptonrc'))
    assert.equal(paths.logFilePath, path.join(directory, 'logs', 'lepton.log'))
    assert.equal(fs.existsSync(paths.logFilePath), true)
    await expectElement('.about-section', paths.configFilePath)
    await expectElement('.about-section', paths.logFilePath)
    if (process.env.LEPTON_UI_ABOUT_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_UI_ABOUT_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await run('window.__configSaved=false; window.lepton.config.set("theme","dark").then(()=>{window.__configSaved=true}); return true')
    await waitFor('return window.__configSaved===true', 'configuration write')
    assert.equal(JSON.parse(fs.readFileSync(paths.configFilePath, 'utf8')).theme, 'dark')
    await closeModal('.about-modal')
  })
  await check('dashboard', async () => { await emit('dashboard'); await expectElement('.dashboard-modal canvas'); await closeModal('.dashboard-modal') })
  await check('search with file content', async () => {
    await run('window.dispatchEvent(new KeyboardEvent("keydown", {key:" ", code:"Space", shiftKey:true, bubbles:true})); return true'); await expectElement('.search-modal .search-box')
    await run('const e=document.querySelector(".search-modal input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"hello"); e.dispatchEvent(new Event("input",{bubbles:true})); return true')
    await run('document.querySelector(".search-modal input").dispatchEvent(new KeyboardEvent("keyup",{bubbles:true,key:"o"})); return true')
    await expectElement('.search-modal', 'React 19 render fixture')
    await emit('search-gist'); await absent('.search-modal')
  })
  await check('delete confirmation', async () => { await emit('delete-gist'); await expectElement('.modal-footer .btn-danger', 'delete'); await click('.modal-footer .btn-default'); await absent('.modal-footer .btn-danger') })
  await check('raw view', async () => { await run('[...document.querySelectorAll(".file-header-control")].find(e=>e.textContent.trim()==="RAW").click(); return true'); await expectElement('.raw-modal .code-area-raw'); await closeModal('.raw-modal') })
  await check('pinned tags', async () => { await click('.configure-tag'); await expectElement('.pinned-tags-modal .pin-tag-list'); await closeModal('.pinned-tags-modal') })
  await check('immersive view', async () => { await emit('immersive-mode'); await expectElement('.snippet-panel-immersive .snippet-box'); await emit('immersive-mode'); await expectElement('.active-layout') })
  await check('combined and empty filters', async () => {
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#JavaScript").click(); return true')
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#ui").click(); return true')
    await expectElement('.snippet-thumnail-description', 'React 19 render fixture')
    assert.equal(await run('return document.querySelectorAll(".snippet-thumnail-description").length'), 1)
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#backend").click(); return true')
    await expectElement('.snippet-thumnail-empty', 'No result found')
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#backend").click(); return true')
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#All").click(); return true')
  })
  await check('language filter and Python multiline highlighting', async () => {
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#Python").click(); return true')
    await expectElement('.snippet-box', 'Python utility'); await waitFor('return [...document.querySelectorAll(".code-table .hljs-string")].some(e=>e.innerText.includes("Preserve multiline docstring highlighting."))', 'Python multiline highlighting')
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#All").click(); return true')
  })
  await check('PHP template highlighting', async () => { await selectSnippet('PHP template'); await expectElement('.code-area .language-php'); await expectElement('.code-area', 'Ready') })
  await check('Jupyter notebook preview', async () => { await selectSnippet('Notebook fixture'); await expectElement('.jupyterNotebook-section .nb-notebook', 'Notebook Fixture') })
  await check('recoverable new-snippet draft', async () => {
    await run('window.lepton.localStorage.set("new-gist-draft-local", {createdAt:"2026-09-06T21:35:00.000Z",description:"Recovered API helper",private:true,gists:[{filename:"recovered.js",content:"const recovered = true"}]}); return true')
    assert.deepEqual(await run('return window.__smokeErrors'), [], 'Renderer errors before refresh')
    await run('window.__reloadMarker=true; return true')
    await request(`/session/${session}/refresh`, {})
    await waitFor('return !window.__reloadMarker && !!window.lepton && !!document.querySelector(".active-layout .snippet-box")', 'reloaded UI')
    await run('window.__smokeErrors=[]; window.addEventListener("error", e=>window.__smokeErrors.push(e.message)); window.addEventListener("unhandledrejection", e=>window.__smokeErrors.push(String(e.reason))); return true')
    await emit('new-gist-renderer')
    await expectElement('.new-gist-draft-callout', 'Local draft available')
    await run('[...document.querySelectorAll(".new-gist-draft-callout button")].find(e=>e.textContent.includes("Load draft")).click(); return true')
    await waitFor('return [...document.querySelectorAll(".gist-editor-form input")].some(e=>e.value==="recovered.js")', 'loaded draft filename')
    await emit('exit-editor'); await absent('.modal .gist-editor-form')
    await run('window.lepton.localStorage.set("new-gist-draft-local", null); return true')
  })
  await check('original logout and provider login screens', async () => {
    assert.equal(await run('return !!document.querySelector(".local-provider-panel") || document.body.innerText.includes("LOCAL SNIPPET")'), false)
    await run('[...document.querySelectorAll(".user-panel-button")].find(e=>e.innerText.trim().toLowerCase()==="logout").click(); return true')
    await expectElement('.logout-modal', 'Confirm logout')
    await click('.logout-modal .btn-danger')
    await expectElement('.login-modal', 'GitHub Login')
    await run('const e=document.querySelector(".login-modal .login-provider-controls select"); e.value="gitlab"; e.dispatchEvent(new Event("change",{bubbles:true})); return true')
    await expectElement('.login-modal', 'GitLab Token Login')
    await run('const e=document.querySelector(".login-modal .login-provider-controls select"); e.value="github"; e.dispatchEvent(new Event("change",{bubbles:true})); return true')
    await expectElement('.login-modal', 'GitHub Login')
    await click('.login-modal-face-front .login-mode-switch')
    await waitFor('return !!document.querySelector(".login-modal-face-front form input") && !document.querySelector(".login-modal-flipping")', 'GitHub token login')
  })
  if (process.env.LEPTON_TEST_GITHUB_TOKEN) {
    await check('live GitHub token connection and profile', async () => {
      await run('const e=document.querySelector(".login-modal-face-front form input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,arguments[0]); e.dispatchEvent(new Event("input",{bubbles:true})); return true', process.env.LEPTON_TEST_GITHUB_TOKEN)
      await run('document.querySelector(".login-modal-face-front form").requestSubmit(); return true')
      for (let n = 0; n < 600; n++) {
        const status = await run('return {connected:!!document.querySelector(".active-layout"), error:document.querySelector(".login-status-line-error")?.innerText}')
        if (status.error) throw new Error(`GitHub connection failed: ${status.error}`)
        if (status.connected) break
        if (n === 599) throw new Error('Timed out connecting to GitHub')
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      await waitFor('const e=document.querySelector(".profile-image-section"); return !!e && e.complete && e.naturalWidth > 0', 'GitHub profile image')
      assert.equal(await run('return document.querySelector(".profile-image-section").src.startsWith("https:")'), true, 'Expected a remote GitHub avatar')
      const starred = await run('const e=document.querySelector(".starred-tag-section a"); return e && {url:e.href, visible:getComputedStyle(e.parentElement.parentElement).display!=="none"}')
      assert.ok(starred?.visible && /^https:\/\/gist\.github\.com\/[^/]+\/starred$/.test(starred.url), 'Expected the original GitHub starred Gists link')
      const remoteLinks = await run('const links=[...document.querySelectorAll(".header-controls a")]; return links.filter(e=>/^https?:/.test(e.href) && getComputedStyle(e).display!=="none").length')
      assert.ok(remoteLinks > 0, 'Expected a visible link to the selected Gist')
      await run('[...document.querySelectorAll(".user-panel-button")].find(e=>e.innerText.trim().toLowerCase()==="logout").click(); return true')
      await expectElement('.logout-modal', 'Confirm logout')
      await click('.logout-modal .btn-danger')
      await expectElement('.active-layout .snippet-box', 'React 19 render fixture')
    })
  }
  const errors = await run('return window.__smokeErrors')
  assert.deepEqual(errors, [], 'Renderer errors')
} finally {
  if (session) { try { await run('window.localStorage.clear(); return true') } catch {} }
  app.kill()
  await new Promise(resolve => { if (app.exitCode !== null) resolve(); else app.once('exit', resolve); setTimeout(resolve, 3000) })
  fs.rmSync(directory, { recursive: true, force: true })
}
