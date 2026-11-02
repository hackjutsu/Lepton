import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-tauri-ui-'))
fs.writeFileSync(path.join(directory, '.leptonrc'), JSON.stringify({ startAtLogin: true, editor: { tabSize: 7 } }))
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
  let driverTimeouts = 0
  for (let n = 0; n < 100; n++) {
    try { if (await run(script)) return } catch (error) {
      if (!String(error).includes('Script execution timed out') || ++driverTimeouts > 2) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${description}`)
}
async function click (selector) { assert.equal(await run('const e=document.querySelector(arguments[0]); if (!e) return false; e.click(); return true', selector), true, `Missing ${selector}`) }
async function assertLoginFits (description) {
  const layout = await run('const face=document.querySelector(".login-modal-face-front"); const bounds=face.getBoundingClientRect(); const elements=[...face.querySelectorAll(".login-modal-title, .button-group-modal button, .button-group-modal input, .button-group-modal select, .login-page-text-link, .login-status-line")]; return {overflow:face.scrollHeight-face.clientHeight, scrollTop:face.scrollTop, clipped:elements.filter(e=>{const r=e.getBoundingClientRect(); return r.top<bounds.top || r.bottom>bounds.bottom}).map(e=>e.innerText || e.getAttribute("aria-label"))}')
  assert.ok(layout.overflow <= 1 && layout.scrollTop === 0 && layout.clipped.length === 0, `${description}: ${JSON.stringify(layout)}`)
}
async function emit (channel) { await run('window.lepton.ipc.emit(arguments[0]); return true', channel) }
async function testWindowAction (action) {
  await run('window.__testWindowResult=null; window.__TAURI_INTERNALS__.invoke("ui_test_window_action",{action:arguments[0]}).then(value=>{window.__testWindowResult={value}}).catch(error=>{window.__testWindowResult={error:String(error)}}); return true', action)
  await waitFor('return window.__testWindowResult!==null', `test window ${action}`)
  const result = await run('return window.__testWindowResult')
  if (result.error) throw new Error(result.error)
  return result.value
}

async function expectElement (selector, text = '') {
  let driverTimeouts = 0
  for (let n = 0; n < 100; n++) {
    try {
      if (await run('const e=document.querySelector(arguments[0]); return !!e && (!arguments[1] || e.innerText.includes(arguments[1]))', selector, text)) return
    } catch (error) {
      if (!String(error).includes('Script execution timed out') || ++driverTimeouts > 2) throw error
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  const diagnostic = await run('return {text:document.body.innerText.slice(0,600), errors:window.__smokeErrors || []}')
  throw new Error(`Timed out waiting for ${selector}: ${text}; ${JSON.stringify(diagnostic)}`)
}
async function absent (selector) { await waitFor(`return !document.querySelector(${JSON.stringify(selector)})`, `closing ${selector}`) }
async function closeModal (selector) { await click(`${selector} .modal-header .close`); await absent(selector) }
async function discardChanges () {
  await expectElement('.discard-editor-modal', 'unsaved changes')
  await click('.discard-editor-modal .btn-danger')
  await absent('.discard-editor-modal')
}
async function selectSnippet (title) {
  const selected = await run('const e=[...document.querySelectorAll(".snippet-thumnail-list-item")].find(x=>x.innerText.includes(arguments[0])); if(!e) return false; e.querySelector("div").click(); return true', title)
  assert.equal(selected, true, `Missing snippet ${title}`)
  await expectElement('.snippet-box', title)
}
async function assertEditorsFillPane (selector, expectedFiles = 1) {
  const layout = await run('const root=document.querySelector(arguments[0]); const outer=root.querySelector(".snippet-code").getBoundingClientRect(); const files=[...root.querySelectorAll(".gist-editor-gist-file > .panel")].map(e=>{const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}); return {outer:{left:outer.left,right:outer.right},files}', selector)
  assert.equal(layout.files.length, expectedFiles)
  for (const file of layout.files) {
    assert.ok(Math.abs(file.left - layout.outer.left) <= 2 && Math.abs(file.right - layout.outer.right) <= 2, `Editors must reach the detail pane edges: ${JSON.stringify(layout)}`)
  }
  for (let i = 1; i < layout.files.length; i++) assert.ok(Math.abs(layout.files[i].top - layout.files[i - 1].bottom) <= 2, `Editors must not have gaps between files: ${JSON.stringify(layout)}`)
}
async function check (name, fn) { await fn(); console.log(`PASS: ${name}`) }
async function fallbackScreenshot (name, selector) {
  if (!process.env.LEPTON_FALLBACK_SCREENSHOT_DIR) return
  await run('const e=document.querySelector(arguments[0]); const box=e.getBoundingClientRect(); if (box.top<75 || box.bottom>innerHeight) e.scrollIntoView({block:"center"}); return true', selector)
  await new Promise(resolve => setTimeout(resolve, 300))
  const screenshot = await request(`/session/${session}/screenshot`)
  fs.writeFileSync(path.join(process.env.LEPTON_FALLBACK_SCREENSHOT_DIR, `${name}.png`), Buffer.from(screenshot, 'base64'))
}
try {
  let ready = false
  for (let n = 0; n < 150; n++) {
    if (app.exitCode !== null) throw new Error(`Tauri test app exited before startup: ${output}`)
    try { await request('/status'); ready = true; break } catch { await new Promise(resolve => setTimeout(resolve, 200)) }
  }
  if (!ready) throw new Error(`WebDriver did not start: ${output}`)
  for (const deadline = Date.now() + 30000; !session;) {
    try { session = (await request('/session', { capabilities: { alwaysMatch: {} } })).sessionId; break } catch (error) {
      if (app.exitCode !== null || !String(error).includes('No window could be found') || Date.now() >= deadline) throw error
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  try { await expectElement('.active-layout .snippet-box', 'React 19 render fixture') } catch (error) {
    const diagnostic = await run('return document.body.innerText.slice(0,1000)')
    throw new Error(`${error.message}; startup text: ${diagnostic}`)
  }
  await run('window.__smokeErrors=[]; window.addEventListener("error", e=>window.__smokeErrors.push(e.message)); window.addEventListener("unhandledrejection", e=>window.__smokeErrors.push(String(e.reason))); return true')
  await check('active layout, local avatar, image and Markdown', async () => {
    const info = await run('const box=document.querySelector(".active-layout").getBoundingClientRect(); const avatar=document.querySelector(".profile-image-section"); const image=document.querySelector(".image-file-view img"); return {width:box.width,height:box.height,avatar:avatar?.naturalWidth,image:image?.naturalWidth,text:document.body.innerText}')
    assert.ok(info.width > 0 && info.height > 0 && info.avatar > 0 && info.image > 0)
    const icons = await run('return [...document.querySelectorAll(".user-panel-icon")].map(e=>{const svg=e.querySelector("svg"), box=e.getBoundingClientRect(), icon=svg?.getBoundingClientRect(); return {box:box.width, width:icon?.width, height:icon?.height}})')
    assert.equal(icons.length, 3)
    for (const icon of icons) assert.ok(icon.width > 0 && icon.height > 0 && Math.abs(icon.width - icon.box) < 1, 'Sidebar icon must fit its container')
    assert.match(info.text, /exercises markdown rendering/)
    assert.deepEqual(await run('return [...document.querySelectorAll("[data-gist-filename]")].map(e=>e.dataset.gistFilename)'), ['hello.js', 'notes.md', 'lepton-logo.webp', 'styles.css'])
    assert.equal(await run('return document.querySelector(".inline-code-editor .CodeMirror")?.CodeMirror.getOption("readOnly")'), true, 'Code should be read-only until editing starts')
    assert.equal(await run('return !!document.querySelector("[data-gist-filename=\\"notes.md\\"] .markdown-section") && !document.querySelector("[data-gist-filename=\\"notes.md\\"] .inline-code-editor")'), true, 'Markdown should retain its rendered preview')
    assert.equal(await run('return !!document.querySelector("[data-gist-filename=\\"lepton-logo.webp\\"] .image-file-view img") && !document.querySelector("[data-gist-filename=\\"lepton-logo.webp\\"] .inline-code-editor")'), true, 'Images should retain their rendered preview')
    const layout = await run('const divider=document.querySelector(".content-split-pane .split-pane-divider.horizontal"); const files=[...document.querySelectorAll("[data-gist-filename]")]; return {dividerBottom:divider.getBoundingClientRect().bottom, viewportBottom:innerHeight, dividerColor:getComputedStyle(divider,"::after").backgroundColor, gaps:files.slice(1).map((file,i)=>file.getBoundingClientRect().top-files[i].getBoundingClientRect().bottom)}')
    assert.ok(Math.abs(layout.dividerBottom - layout.viewportBottom) < 2, 'Snippet divider should reach the bottom of the window')
    assert.notEqual(layout.dividerColor, 'rgba(0, 0, 0, 0)', 'Snippet divider should remain visible')
    assert.ok(layout.gaps.every(gap => Math.abs(gap) < 1), `Unexpected space between files: ${layout.gaps}`)
    assert.equal(await run('const e=document.querySelector(".starred-tag-section"); return !!e && getComputedStyle(e).display!=="none"'), false, 'Local library should not show a GitHub starred link')
  })
  const screenshot = await request(`/session/${session}/screenshot`)
  const artifact = process.env.LEPTON_UI_SCREENSHOT || path.join(directory, 'active.png')
  fs.writeFileSync(artifact, Buffer.from(screenshot, 'base64'))
  console.log(`Screenshot: ${artifact}`)
  if (process.env.LEPTON_FALLBACK_SCREENSHOT_DIR) {
    const files = JSON.parse(fs.readFileSync('tests/ui/fixtures.json', 'utf8'))[0].files
    await run('window.__screenFixtures=null; Promise.all([window.lepton.snippets.request(null,"CREATE_SINGLE_GIST",["local","[Markdown example] #docs",{"notes.md":{content:arguments[0]}},true]),window.lepton.snippets.request(null,"CREATE_SINGLE_GIST",["local","[Image example] #docs",{"lepton-logo.webp":{content:arguments[1]}},true])]).then(value=>{window.__screenFixtures=value}); return true', '# Project notes\n\nA rendered Markdown document.\n\n- Keep useful examples together\n- Share notes with your team\n\n```js\nconsole.log("Hello, Lepton!")\n```', files['lepton-logo.webp'].content)
    await waitFor('return !!window.__screenFixtures', 'rendered examples fixtures')
    await emit('sync-gists')
    await waitFor('return document.body.innerText.includes("Markdown example") && document.body.innerText.includes("Image example")', 'rendered examples sync')
    await selectSnippet('Markdown example')
    await expectElement('.markdown-section', 'Project notes')
    await fallbackScreenshot('markdown', '[data-gist-filename="notes.md"]')
    await selectSnippet('Image example')
    await waitFor('return document.querySelector(".image-file-view img")?.naturalWidth>0', 'image example')
    await fallbackScreenshot('image', '[data-gist-filename="lepton-logo.webp"]')
    await run('window.__screenDeleted=false; Promise.all(window.__screenFixtures.map(gist=>window.lepton.snippets.request(null,"DELETE_SINGLE_GIST",["local",gist.id]))).then(()=>{window.__screenDeleted=true}); return true')
    await waitFor('return window.__screenDeleted', 'remove rendered examples')
    await emit('sync-gists')
    await waitFor('return !document.body.innerText.includes("Markdown example") && !document.body.innerText.includes("Image example")', 'rendered examples removed')
    await selectSnippet('React 19 render fixture')
  }
  await check('startup autostart and native tray preferences', async () => {
    const status = await testWindowAction('status')
    assert.equal(status.autostart, true, 'startAtLogin from .leptonrc must be applied on startup')
    if (process.platform === 'linux') return // A desktop tray host is not guaranteed under Xvfb.
    await run('window.__trayReady=false; window.lepton.config.set("window:closeToTray",true).then(()=>window.__TAURI_INTERNALS__.invoke("ui_test_window_action",{action:"close"})).then(()=>{window.__trayReady=true}); return true')
    await waitFor('return window.__trayReady===true', 'close to tray')
    let state
    for (let n = 0; n < 100; n++) {
      state = await testWindowAction('status')
      if (!state.visible && state.tray) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(state.visible, false, 'Close-to-tray should hide the window')
    assert.equal(state.tray, true, 'Close-to-tray should create the tray')
    await testWindowAction('show')
    await run('window.__minimizeReady=false; window.lepton.config.set("window:minimizeToTray",true).then(()=>window.__TAURI_INTERNALS__.invoke("ui_test_window_action",{action:"minimize"})).then(()=>{window.__minimizeReady=true}); return true')
    await waitFor('return window.__minimizeReady===true', 'minimize request')
    for (let n = 0; n < 100; n++) {
      state = await testWindowAction('status')
      if (!state.visible && state.tray) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(state.visible, false, 'Minimize-to-tray should hide the window')
    assert.equal(state.tray, true, 'Minimize-to-tray should keep the tray available')
    state = await testWindowAction('show')
    assert.equal(state.visible, true, 'The window should restore from the tray')
    await run('window.__trayReset=false; Promise.all([window.lepton.config.set("window:closeToTray",false),window.lepton.config.set("window:minimizeToTray",false)]).then(()=>{window.__trayReset=true}); return true')
    await waitFor('return window.__trayReset===true', 'tray preferences reset')
  })
  await check('new editor', async () => { await emit('new-gist-renderer'); await expectElement('.inline-new-editor .gist-editor-form .CodeMirror'); assert.equal(await run('return !!document.querySelector(".modal .gist-editor-form")'), false); await click('.inline-new-editor [title=Cancel]'); await absent('.inline-new-editor') })
  await check('edit editor', async () => { await emit('edit-gist-renderer'); await expectElement('.inline-form-edit .gist-editor-form .CodeMirror'); assert.equal(await run('return !!document.querySelector(".modal .gist-editor-form")'), false); await click('.inline-form-edit [title=Cancel]'); await absent('.inline-form-edit') })
  await check('create and edit rendered snippets without a modal', async () => {
    await emit('new-gist-renderer')
    await expectElement('.inline-new-editor .gist-editor-form .CodeMirror')
    await assertEditorsFillPane('.inline-new-editor')
    assert.equal(await run('return document.querySelector(".menu-panel").inert && document.querySelector(".panel-thumbnails-background").inert'), true, 'Navigation must not replace an unsaved form')
    await run('const set=(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,value); el.dispatchEvent(new Event("input",{bubbles:true}))}; set(document.querySelector(".inline-new-editor .gist-editor-input-area"),"[In-place Markdown] #test"); set(document.querySelector(".inline-new-editor .gist-editor-filename-area"),"notes.md"); document.querySelector(".inline-new-editor .CodeMirror").CodeMirror.setValue("# Original\\n"); return true')
    await click('.inline-new-editor [title=Cancel]')
    await expectElement('.discard-editor-modal', 'unsaved changes')
    await click('.discard-editor-modal .btn-default')
    await absent('.discard-editor-modal')
    assert.equal(await run('return document.querySelector(".inline-new-editor .CodeMirror").CodeMirror.getValue()'), '# Original\n', 'Keeping the new editor must retain its draft')
    if (process.env.LEPTON_NEW_INLINE_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_NEW_INLINE_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await click('.inline-new-editor [title=Submit]')
    await absent('.inline-new-editor')
    await expectElement('.snippet-box', 'In-place Markdown')
    await expectElement('.markdown-section', 'Original')
    assert.equal(await run('return document.querySelector(".menu-panel").inert'), false, 'Navigation should be restored after creation')
    await click('.header-controls [title=Edit]')
    await expectElement('.inline-form-edit .gist-editor-form .CodeMirror')
    await assertEditorsFillPane('.inline-form-edit')
    assert.equal(await run('return !!document.querySelector(".modal .gist-editor-form")'), false)
    await run('const set=(e,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,value); e.dispatchEvent(new Event("input",{bubbles:true}))}; set(document.querySelector(".inline-form-edit .gist-editor-input-area"),"[In-place Markdown updated] #test"); set(document.querySelector(".inline-form-edit .gist-editor-filename-area"),"updated.md"); document.querySelector(".inline-form-edit .CodeMirror").CodeMirror.setValue("# Updated\\n"); return true')
    if (process.env.LEPTON_FULL_INLINE_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_FULL_INLINE_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await click('.inline-form-edit [title=Submit]')
    await absent('.inline-form-edit')
    await expectElement('.snippet-box', 'In-place Markdown updated')
    await expectElement('.markdown-section', 'Updated')
    await expectElement('.file-expand', 'updated.md')
    await click('.header-controls [title=Edit]')
    await expectElement('.inline-form-edit .CodeMirror')
    await run('document.querySelector(".inline-form-edit .CodeMirror").CodeMirror.setValue("# Discarded\\n"); return true')
    await click('.inline-form-edit [title=Cancel]')
    await expectElement('.discard-editor-modal', 'unsaved changes')
    await click('.discard-editor-modal .btn-default')
    await absent('.discard-editor-modal')
    assert.equal(await run('return document.querySelector(".inline-form-edit .CodeMirror").CodeMirror.getValue()'), '# Discarded\n')
    await click('.inline-form-edit [title=Cancel]')
    await discardChanges()
    await absent('.inline-form-edit')
    await expectElement('.markdown-section', 'Updated')
    await click('.header-controls [title=Delete]')
    await expectElement('.modal-footer .btn-danger', 'delete')
    await click('.modal-footer .btn-danger')
    await waitFor('return !document.body.innerText.includes("In-place Markdown updated")', 'remove test snippet')
    await selectSnippet('React 19 render fixture')
  })
  await check('in-place code edit, cancel, navigation, and save', async () => {
    await selectSnippet('Python utility')
    const editor = '[data-inline-filename="parser.py"] .CodeMirror'
    const initial = await run('return document.querySelector(arguments[0]).CodeMirror.getValue()', editor)
    assert.equal(await run('return document.querySelector(arguments[0]).CodeMirror.getOption("readOnly")', editor), true)
    const originalIcons = await run('return [...document.querySelectorAll(".header-controls a.snippet-control")].map(e=>e.querySelector("svg").outerHTML)')
    assert.equal(await run('return document.querySelectorAll(".inline-toolbar-action").length'), 0, 'Read-only toolbar must remain unchanged')
    await click('.header-controls [title="Edit"]')
    await waitFor('return !!document.querySelector(".snippet-box.inline-editing")', 'inline editor')
    assert.equal(await run('return !!document.querySelector(".edit-modal .gist-editor-form")'), false, 'Code editing should not open a modal')
    assert.equal(await run('return document.querySelector(arguments[0]).CodeMirror.getOption("readOnly")', editor), false)
    assert.deepEqual(await run('return [...document.querySelectorAll(".header-controls a.snippet-control")].map(e=>e.querySelector("svg").outerHTML)'), originalIcons, 'Editing must preserve the original toolbar icons')
    assert.equal(await run('return [...document.querySelectorAll(".inline-toolbar-action")].filter(e=>getComputedStyle(e).display!=="none").length'), 2, 'Cancel and submit must be visible in the local library')
    await run('document.querySelector(arguments[0]).CodeMirror.setValue(arguments[1]); return true', editor, initial + '\n# cancelled')
    if (process.env.LEPTON_INLINE_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_INLINE_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await emit('new-gist-renderer')
    await expectElement('.inline-new-editor .gist-editor-form')
    await emit('submit-gist')
    await expectElement('.inline-new-editor .error-msg', 'required')
    await click('.inline-new-editor [title=Cancel]')
    await absent('.inline-new-editor')
    assert.match(await run('return document.querySelector(arguments[0]).CodeMirror.getValue()', editor), /# cancelled/, 'Creating a snippet must not submit or discard an existing inline draft')
    await selectSnippet('Shell setup')
    await selectSnippet('Python utility')
    assert.match(await run('return document.querySelector(arguments[0]).CodeMirror.getValue()', editor), /# cancelled/, 'Switching snippets must retain an unsaved draft')
    await click('.inline-edit-actions [title="Cancel"]')
    await expectElement('.discard-editor-modal', 'unsaved changes')
    if (process.env.LEPTON_DISCARD_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_DISCARD_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await click('.discard-editor-modal .btn-default')
    await absent('.discard-editor-modal')
    assert.match(await run('return document.querySelector(arguments[0]).CodeMirror.getValue()', editor), /# cancelled/)
    await click('.inline-edit-actions [title="Cancel"]')
    await discardChanges()
    await waitFor('return !document.querySelector(".snippet-box.inline-editing")', 'cancel inline editing')
    assert.equal(await run('return document.querySelector(arguments[0]).CodeMirror.getValue()', editor), initial, 'Cancel must restore the saved content')
    await click('.header-controls [title="Edit"]')
    await run('document.querySelector(arguments[0]).CodeMirror.setValue(arguments[1]); return true', editor, initial + '\n# saved inline')
    await click('.inline-edit-actions [title="Submit"]')
    await waitFor('return !document.querySelector(".snippet-box.inline-editing")', 'save inline editing')
    await run('window.__inlineStored=null; window.lepton.snippets.request(null,"GET_SINGLE_GIST",["local","fixture-gist-2"]).then(value=>{window.__inlineStored=value}); return true')
    await waitFor('return !!window.__inlineStored', 'saved local snippet')
    assert.equal(await run('return window.__inlineStored.description'), '[Python utility] #backend Small parser helper fixture.')
    assert.deepEqual(await run('return Object.keys(window.__inlineStored.files)'), ['parser.py'])
    assert.match(await run('return window.__inlineStored.files["parser.py"].content'), /# saved inline/)
    await emit('sync-gists')
    await waitFor('return document.querySelector("[data-inline-filename=\\"parser.py\\"] .CodeMirror")?.CodeMirror.getValue().includes("# saved inline")', 'saved code after sync')
    await click('.header-controls [title="Edit"]')
    await run('document.querySelector(arguments[0]).CodeMirror.setValue(arguments[1]); return true', editor, initial)
    await click('.inline-edit-actions [title="Submit"]')
    await waitFor('return !document.querySelector(".snippet-box.inline-editing")', 'restore fixture')
    await click('.header-controls [title="Edit"]')
    await run('document.querySelector(arguments[0]).CodeMirror.setValue(arguments[1]); return true', editor, initial + '\n# kept in details')
    await click('.inline-edit-actions [title="Edit details…"]')
    await expectElement('.inline-form-edit .gist-editor-form')
    assert.match(await run('return document.querySelector(".inline-form-edit .CodeMirror").CodeMirror.getValue()'), /# kept in details/, 'Opening file details must retain inline edits')
    await emit('exit-editor'); await discardChanges(); await absent('.inline-form-edit .gist-editor-form')
    assert.equal(await run('return document.querySelector(arguments[0]).CodeMirror.getValue()', editor), initial)
    await run('window.__inlineCreated=null; window.lepton.snippets.request(null,"CREATE_SINGLE_GIST",["local","[Inline multiple files] #test",{"first.js":{"content":"const first = 1;\\n"},"second.py":{"content":"second = 2\\n"}},true]).then(value=>{window.__inlineCreated=value}); return true')
    await waitFor('return !!window.__inlineCreated', 'multi-file fixture creation')
    await emit('sync-gists')
    await waitFor('return document.body.innerText.includes("Inline multiple files")', 'multi-file fixture sync')
    await selectSnippet('Inline multiple files')
    await click('.header-controls [title="Edit"]')
    assert.equal(await run('return [...document.querySelectorAll(".inline-code-editor .CodeMirror")].filter(e=>!e.CodeMirror.getOption("readOnly")).length'), 2, 'Both code files should be editable')
    await run('document.querySelector("[data-inline-filename=\\"first.js\\"] .CodeMirror").CodeMirror.setValue("const first = 3;\\n"); document.querySelector(".inline-edit-actions [title=Submit]").click(); return true')
    await waitFor('return !document.querySelector(".snippet-box.inline-editing")', 'save multi-file snippet')
    await run('window.__multiStored=null; window.lepton.snippets.request(null,"GET_SINGLE_GIST",["local",window.__inlineCreated.id]).then(value=>{window.__multiStored=value}); return true')
    await waitFor('return !!window.__multiStored', 'saved multi-file snippet')
    assert.equal(await run('return window.__multiStored.files["first.js"].content'), 'const first = 3;\n')
    assert.equal(await run('return window.__multiStored.files["second.py"].content'), 'second = 2\n', 'Saving one file must not overwrite another')
    await run('window.__multiDeleted=false; window.lepton.snippets.request(null,"DELETE_SINGLE_GIST",["local",window.__inlineCreated.id]).then(()=>{window.__multiDeleted=true}); return true')
    await waitFor('return window.__multiDeleted===true', 'delete multi-file fixture')
    await emit('sync-gists')
    await waitFor('return !document.body.innerText.includes("Inline multiple files")', 'multi-file fixture removed')
    await selectSnippet('React 19 render fixture')
  })
  await check('mixed snippets retain image attachments while editing in place', async () => {
    const image = JSON.parse(fs.readFileSync('tests/ui/fixtures.json', 'utf8'))[0].files['lepton-logo.webp'].content
    await run('window.__mixed=null; window.lepton.snippets.request(null,"CREATE_SINGLE_GIST",["local","[Mixed editor fixture] #test",{"notes.md":{content:"# Before\\n"},"lepton-logo.webp":{content:arguments[0]}},true]).then(value=>{window.__mixed=value}); return true', image)
    await waitFor('return !!window.__mixed', 'mixed fixture creation')
    await emit('sync-gists')
    await waitFor('return document.body.innerText.includes("Mixed editor fixture")', 'mixed fixture sync')
    await selectSnippet('Mixed editor fixture')
    await click('.header-controls [title=Edit]')
    await expectElement('.inline-form-edit .gist-editor-form .CodeMirror')
    await waitFor('return document.querySelector(".inline-form-edit .image-file-view img")?.naturalWidth>0', 'image preview in form')
    await assertEditorsFillPane('.inline-form-edit', 2)
    await run('document.querySelector(".inline-form-edit .CodeMirror").CodeMirror.setValue("# After\\n"); return true')
    await click('.inline-form-edit [title=Submit]')
    await absent('.inline-form-edit')
    await expectElement('.markdown-section', 'After')
    await run('window.__mixedStored=null; window.lepton.snippets.request(null,"GET_SINGLE_GIST",["local",window.__mixed.id]).then(value=>{window.__mixedStored=value}); return true')
    await waitFor('return !!window.__mixedStored', 'mixed fixture saved')
    assert.equal(await run('return window.__mixedStored.files["lepton-logo.webp"].content'), image, 'Editing text must preserve the image data')
    await run('window.__mixedDeleted=false; window.lepton.snippets.request(null,"DELETE_SINGLE_GIST",["local",window.__mixed.id]).then(()=>{window.__mixedDeleted=true}); return true')
    await waitFor('return window.__mixedDeleted', 'mixed fixture deleted')
    await emit('sync-gists')
    await waitFor('return !document.body.innerText.includes("Mixed editor fixture")', 'mixed fixture removed')
    await selectSnippet('React 19 render fixture')
  })
  await check('about and settings paths', async () => {
    await emit('about-page'); await expectElement('.about-modal .modal-title', 'Settings')
    await run('[...document.querySelectorAll(".settings-tabs button")].find(e=>e.textContent.trim()==="About").click(); return true')
    await expectElement('.about-section', 'Configurations')
    const paths = await run('return window.lepton.globals.getPaths()')
    assert.equal(paths.configFilePath, path.join(directory, '.leptonrc'))
    assert.equal(await run('return window.lepton.config.get("editor:tabSize")'), 7, 'Preferences must load from .leptonrc at startup')
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
    await run('window.__configSaved=false; window.lepton.config.set("theme","light").then(()=>{window.__configSaved=true}); return true')
    await waitFor('return window.__configSaved===true', 'configuration reset')
    await run('window.__restartSaved=false; window.lepton.config.setForRestart("avatar:type","boring").then(()=>{window.__restartSaved=true}); return true')
    await waitFor('return window.__restartSaved===true', 'restart preference write')
    assert.equal(await run('return window.lepton.config.get("avatar:type")'), 'github')
    assert.equal(JSON.parse(fs.readFileSync(paths.configFilePath, 'utf8')).avatar.type, 'boring')
    await run('window.__restartSaved=false; window.lepton.config.setForRestart("avatar:type","github").then(()=>{window.__restartSaved=true}); return true')
    await waitFor('return window.__restartSaved===true', 'restart preference reset')
    await closeModal('.about-modal')
    await run('window.__tabSizeSaved=false; window.lepton.config.set("editor:tabSize",4).then(()=>{window.__tabSizeSaved=true}); return true')
    await waitFor('return window.__tabSizeSaved===true', 'valid tab size for preferences')
  })
  await check('theme changes update rendered syntax and the editor', async () => {
    const themes = [
      ['dark', 'rgb(152, 195, 121)', 'one-dark'],
      ['one-dark', 'rgb(152, 195, 121)', 'one-dark'],
      ['atom-one-dark', 'rgb(152, 195, 121)', 'one-dark'],
      ['github-dark', 'rgb(165, 214, 255)', 'github-dark'],
      ['catppuccin-mocha', 'rgb(152, 195, 121)', 'one-dark'],
      ['solarized-dark', 'rgb(42, 161, 152)', 'solarized dark'],
      ['dracula', 'rgb(241, 250, 140)', 'dracula'],
      ['material-theme', 'rgb(195, 232, 141)', 'material'],
      ['ayu', 'rgb(194, 217, 76)', 'ayu-dark'],
      ['light', 'rgb(3, 47, 98)', 'github']
    ]
    for (const [theme, , editorTheme] of themes) {
      await emit('about-page'); await expectElement('.about-modal [data-preference-key="theme"]')
      await run('const select=document.querySelector(".about-modal [data-preference-key=theme]"); select.value=arguments[0]; select.dispatchEvent(new Event("change",{bubbles:true})); return true', theme)
      try {
        await waitFor('const e=[...document.querySelectorAll(".preferences-footer button")].find(e=>e.textContent.trim()==="Apply"); return e && !e.disabled', `${theme} preference change`)
      } catch (error) {
        const details = await run('return {footer:document.querySelector(".preferences-footer").innerText, selected:document.querySelector(".about-modal [data-preference-key=theme]").value, buttons:[...document.querySelectorAll(".preferences-footer button")].map(b=>[b.innerText,b.disabled])}')
        throw new Error(`${error.message}: ${JSON.stringify(details)}`)
      }
      await run('[...document.querySelectorAll(".preferences-footer button")].find(e=>e.textContent.trim()==="Apply").click(); return true')
      try {
        await waitFor(`const e=document.querySelector('[data-inline-filename="hello.js"] .CodeMirror'); return window.lepton.config.get("theme")===${JSON.stringify(theme)} && e?.CodeMirror.getOption("theme")===${JSON.stringify(editorTheme)} && !!e.querySelector('.cm-string')`, `${theme} syntax color`)
      } catch (error) {
        const details = await run('const e=document.querySelector(".inline-code-editor .CodeMirror"); return {theme:window.lepton.config.get("theme"), editorTheme:e?.CodeMirror.getOption("theme"), selected:document.querySelector(".about-modal [data-preference-key=theme]").value}')
        throw new Error(`${error.message}: ${JSON.stringify(details)}`)
      }
      await closeModal('.about-modal')
      if (theme === 'dark' && process.env.LEPTON_UI_DARK_SCREENSHOT) {
        const screenshot = await request(`/session/${session}/screenshot`)
        fs.writeFileSync(process.env.LEPTON_UI_DARK_SCREENSHOT, Buffer.from(screenshot, 'base64'))
      }
      const previewColor = await run('return getComputedStyle(document.querySelector(".inline-code-editor .cm-string")).color')
      await emit('edit-gist-renderer'); await expectElement('.inline-form-edit .CodeMirror')
      assert.equal(await run('return document.querySelector(".inline-form-edit .CodeMirror").CodeMirror.getOption("theme")'), editorTheme, `${theme} editor theme`)
      assert.equal(previewColor, await run('return getComputedStyle(document.querySelector(".inline-form-edit .CodeMirror .cm-string")).color'), `${theme} preview and editor syntax colors`)
      if (theme === 'dark' && process.env.LEPTON_UI_DARK_SCREENSHOT) {
        const screenshot = await request(`/session/${session}/screenshot`)
        fs.writeFileSync(process.env.LEPTON_UI_DARK_SCREENSHOT.replace(/\.png$/, '-editor.png'), Buffer.from(screenshot, 'base64'))
      }
      await emit('exit-editor'); await absent('.inline-form-edit .gist-editor-form')
    }
  })
  await check('zoom preference changes the native webview', async () => {
    const before = await run('return window.innerWidth')
    await run('window.__zoomDone=false; window.lepton.config.set("zoom:percent",125).then(()=>{window.__zoomDone=true}); return true')
    await waitFor('return window.__zoomDone===true', 'zoom setting')
    await waitFor(`return window.innerWidth < ${before} * 0.9`, 'webview zoom')
    await run('window.__zoomDone=false; window.lepton.config.set("zoom:percent",100).then(()=>{window.__zoomDone=true}); return true')
    await waitFor('return window.__zoomDone===true', 'zoom reset')
    await waitFor(`return window.innerWidth >= ${before} * 0.95`, 'webview zoom reset')
  })
  await check('platform zoom shortcuts work in the editor without changing the saved default', async () => {
    const before = await run('return window.innerWidth')
    await emit('edit-gist-renderer'); await expectElement('.inline-form-edit .CodeMirror')
    const sendKey = async (key, code, shift = false) => run('const mac=/mac|iphone|ipad/i.test(navigator.platform); const target=document.querySelector(".inline-form-edit .CodeMirror textarea") || document.querySelector(".inline-form-edit .CodeMirror"); const event=new KeyboardEvent("keydown",{key:arguments[0],code:arguments[1],shiftKey:arguments[2],metaKey:mac,ctrlKey:!mac,bubbles:true,cancelable:true}); return !target.dispatchEvent(event)', key, code, shift)
    assert.equal(await sendKey('=', 'Equal'), true, 'Zoom shortcut should prevent the default key action')
    await waitFor(`return window.innerWidth < ${before} * 0.9`, 'shortcut zoom in')
    assert.equal(await run('return window.lepton.config.get("zoom:percent")'), 100)
    assert.equal(await sendKey('-', 'Minus'), true)
    await waitFor(`return window.innerWidth >= ${before} * 0.95`, 'shortcut zoom out')
    assert.equal(await sendKey('+', 'Equal', true), true)
    await waitFor(`return window.innerWidth < ${before} * 0.9`, 'shift-plus shortcut')
    assert.equal(await sendKey('0', 'Digit0'), true)
    await waitFor(`return window.innerWidth >= ${before} * 0.95`, 'shortcut zoom reset')
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, '.leptonrc'), 'utf8')).zoom.percent, 100)
    await emit('exit-editor'); await absent('.inline-form-edit .gist-editor-form')
  })
  await check('autostart preference and native notification bridge', async () => {
    await run('window.__autostartDone=false; window.lepton.config.set("startAtLogin",true).then(()=>{window.__autostartDone=true}); new Notification("Lepton test",{body:"Test notification",silent:true}); return true')
    await waitFor('return window.__autostartDone===true && window.lepton.config.get("startAtLogin")===true', 'autostart preference')
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, '.leptonrc'), 'utf8')).startAtLogin, true)
    await run('window.__autostartDone=false; window.lepton.config.set("startAtLogin",false).then(()=>{window.__autostartDone=true}); return true')
    await waitFor('return window.__autostartDone===true && window.lepton.config.get("startAtLogin")===false', 'autostart reset')
  })
  await check('dashboard', async () => { await emit('dashboard'); await expectElement('.dashboard-modal canvas'); await closeModal('.dashboard-modal') })
  await check('search with file content', async () => {
    await run('window.dispatchEvent(new KeyboardEvent("keydown", {key:" ", code:"Space", shiftKey:true, bubbles:true})); return true'); await expectElement('.search-modal .search-box')
    await run('const e=document.querySelector(".search-modal input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,"hello"); e.dispatchEvent(new Event("input",{bubbles:true})); return true')
    await run('document.querySelector(".search-modal input").dispatchEvent(new KeyboardEvent("keyup",{bubbles:true,key:"o"})); return true')
    await expectElement('.search-modal', 'React 19 render fixture')
    await emit('search-gist'); await absent('.search-modal')
  })
  await check('delete confirmation', async () => {
    const selected = await run('return document.querySelector(".snippet-box .title-section")?.innerText')
    await emit('delete-gist')
    await expectElement('.modal-footer .btn-danger', 'delete')
    if (process.env.LEPTON_DELETE_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_DELETE_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await click('.modal-footer .btn-default')
    await absent('.modal-footer .btn-danger')
    assert.equal(await run('return document.querySelector(".snippet-box .title-section")?.innerText'), selected, 'Cancelling deletion must retain the selected snippet')
  })
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
    await expectElement('.snippet-box', 'Python utility'); await waitFor('return [...document.querySelectorAll(".inline-code-editor .cm-string")].some(e=>e.innerText.includes("Preserve multiline docstring highlighting."))', 'Python multiline highlighting')
    await run('[...document.querySelectorAll("[role=button]")].find(e=>e.textContent.trim()==="#All").click(); return true')
  })
  await check('PHP template highlighting', async () => { await selectSnippet('PHP template'); await expectElement('.inline-code-editor .CodeMirror', 'Ready') })
  await check('Jupyter notebook preview', async () => { await selectSnippet('Notebook fixture'); await expectElement('.jupyterNotebook-section .nb-notebook', 'Notebook Fixture'); assert.equal(await run('return !!document.querySelector(".jupyterNotebook-section") && !document.querySelector(".inline-code-editor")'), true); await fallbackScreenshot('notebook', '.jupyterNotebook-section'); await click('.header-controls [title="Edit"]'); await expectElement('.inline-form-edit .gist-editor-form'); await emit('exit-editor'); await absent('.inline-form-edit .gist-editor-form') })
  await check('recoverable new-snippet draft', async () => {
    await run('window.lepton.localStorage.set("new-gist-draft-local", {createdAt:"2026-09-06T21:35:00.000Z",description:"Recovered API helper",private:true,gists:[{filename:"recovered.js",content:"const recovered = true"}]}); return true')
    assert.deepEqual(await run('return window.__smokeErrors'), [], 'Renderer errors before refresh')
    await run('window.localStorage.setItem("lepton-local-config", JSON.stringify({enterprise:{enable:true},editor:{tabSize:8}})); window.__reloadMarker=true; return true')
    await request(`/session/${session}/refresh`, {})
    await waitFor('return !window.__reloadMarker && !!window.lepton && !!document.querySelector(".active-layout .snippet-box")', 'reloaded UI')
    assert.equal(await run('return window.lepton.config.get("enterprise:enable")'), false, 'Stale WebView settings must not override defaults when absent from .leptonrc')
    assert.equal(await run('return window.lepton.config.get("editor:tabSize")'), 4, '.leptonrc must take precedence over stale WebView settings')
    await run('window.__smokeErrors=[]; window.addEventListener("error", e=>window.__smokeErrors.push(e.message)); window.addEventListener("unhandledrejection", e=>window.__smokeErrors.push(String(e.reason))); return true')
    await emit('new-gist-renderer')
    await expectElement('.new-gist-draft-callout', 'Local draft available')
    await run('[...document.querySelectorAll(".new-gist-draft-callout button")].find(e=>e.textContent.includes("Load draft")).click(); return true')
    await waitFor('return [...document.querySelectorAll(".gist-editor-form input")].some(e=>e.value==="recovered.js")', 'loaded draft filename')
    await emit('exit-editor'); await discardChanges(); await absent('.inline-new-editor .gist-editor-form')
    await run('window.lepton.localStorage.set("new-gist-draft-local", null); return true')
  })
  await check('original logout and provider login screens', async () => {
    assert.equal(await run('return !!document.querySelector(".local-provider-panel") || document.body.innerText.includes("LOCAL SNIPPET")'), false)
    await run('[...document.querySelectorAll(".user-panel-button")].find(e=>e.innerText.trim().toLowerCase()==="logout").click(); return true')
    await expectElement('.logout-modal', 'Confirm logout')
    await click('.logout-modal .btn-danger')
    await expectElement('.login-modal', 'GitHub Login')
    await waitFor('return !document.querySelector(".logout-modal") && !document.querySelector(".modal-backdrop")', 'logout transition to finish')
    await assertLoginFits('GitHub login')
    if (process.env.LEPTON_UI_LOGIN_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_UI_LOGIN_SCREENSHOT, Buffer.from(screenshot, 'base64'))
    }
    await run('const e=document.querySelector(".login-modal .login-provider-controls select"); e.value="gitlab"; e.dispatchEvent(new Event("change",{bubbles:true})); return true')
    await expectElement('.login-modal', 'GitLab Token Login')
    await assertLoginFits('GitLab token login')
    if (process.env.LEPTON_UI_LOGIN_SCREENSHOT) {
      const screenshot = await request(`/session/${session}/screenshot`)
      fs.writeFileSync(process.env.LEPTON_UI_LOGIN_SCREENSHOT.replace(/\.png$/, '-gitlab.png'), Buffer.from(screenshot, 'base64'))
    }
    await run('const e=document.querySelector(".login-modal .login-provider-controls select"); e.value="github"; e.dispatchEvent(new Event("change",{bubbles:true})); return true')
    await expectElement('.login-modal', 'GitHub Login')
    await click('.login-modal-face-front .login-mode-switch')
    await waitFor('return !!document.querySelector(".login-modal-face-front form input") && !document.querySelector(".login-modal-flipping")', 'GitHub token login')
    await assertLoginFits('GitHub token login')
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
      const accountFile = path.join(directory, 'remote-account.json')
      for (let n = 0; n < 100 && !fs.existsSync(accountFile); n++) await new Promise(resolve => setTimeout(resolve, 100))
      assert.equal(fs.existsSync(accountFile), true, 'Expected remembered account metadata')
      assert.equal(fs.readFileSync(accountFile, 'utf8').includes(process.env.LEPTON_TEST_GITHUB_TOKEN), false, 'Token must not be saved in account metadata')
      assert.equal(await run('return document.querySelector(".profile-image-section").src.startsWith("https:")'), true, 'Expected a remote GitHub avatar')
      const starred = await run('const e=document.querySelector(".starred-tag-section a"); return e && {url:e.href, visible:getComputedStyle(e.parentElement.parentElement).display!=="none"}')
      assert.ok(starred?.visible && /^https:\/\/gist\.github\.com\/[^/]+\/starred$/.test(starred.url), 'Expected the original GitHub starred Gists link')
      const remoteLinks = await run('const links=[...document.querySelectorAll(".header-controls a")]; return links.filter(e=>/^https?:/.test(e.href) && getComputedStyle(e).display!=="none").length')
      assert.ok(remoteLinks > 0, 'Expected a visible link to the selected Gist')
      await run('[...document.querySelectorAll(".user-panel-button")].find(e=>e.innerText.trim().toLowerCase()==="logout").click(); return true')
      await expectElement('.logout-modal', 'Confirm logout')
      await click('.logout-modal .btn-danger')
      await expectElement('.login-modal', 'GitHub Login')
      for (let n = 0; n < 100 && fs.existsSync(accountFile); n++) await new Promise(resolve => setTimeout(resolve, 100))
      assert.equal(fs.existsSync(accountFile), false, 'Logout should remove account metadata')
      await run('window.__reloadMarker=true; return true')
      await request(`/session/${session}/refresh`, {})
      await waitFor('return !window.__reloadMarker && !!document.querySelector(".active-layout .snippet-box")', 'local library after restart')
      await expectElement('.active-layout .snippet-box', 'React 19 render fixture')
      await run('window.__smokeErrors=[]; window.addEventListener("error", e=>window.__smokeErrors.push(e.message)); window.addEventListener("unhandledrejection", e=>window.__smokeErrors.push(String(e.reason))); return true')
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
