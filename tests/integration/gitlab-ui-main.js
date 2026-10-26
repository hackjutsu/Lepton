const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow, clipboard, Menu } = require('electron')
const { createGitLabApi } = require('../../app/utilities/gitlabApi/core')
const op = require('../../app/utilities/snippetApi/operations')
const token = process.env.LEPTON_E2E_TOKEN
const baseUrl = process.env.LEPTON_E2E_URL
const artifacts = process.env.LEPTON_E2E_ARTIFACTS
const phase = process.env.LEPTON_E2E_PHASE || 'main'
delete process.env.LEPTON_E2E_TOKEN
const api = createGitLabApi({ provider: { type: 'gitlab', baseUrl }, fetchImpl: fetch })
const request = (operation, ...args) => api.getRequest(operation)(token, ...args)
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const repo = path.resolve(__dirname, '../..')
app.getAppPath = () => repo
require(path.join(repo, 'main.js'))
let window
let step = 'startup'
const failures = []
const evaluate = code => window.webContents.executeJavaScript(code, true)
async function until (check, description, timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await check()) return
    await pause(150)
  }
  throw new Error(`Timed out: ${description}`)
}
const visible = selector => until(() => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), selector)
async function click (selector) {
  await visible(selector)
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  await pause(100)
}
async function textClick (selector, text) {
  await until(() => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector)})].some(e => e.innerText.trim() === ${JSON.stringify(text)})`), `visible control ${text}`)
  const found = await evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.innerText.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true })()`)
  assert.ok(found, `Missing ${selector}: ${text}`)
  await pause(100)
}
async function input (selector, value, index = 0) {
  await evaluate(`(() => { const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  await pause(60)
}
async function code (index, value) {
  await evaluate(`document.querySelectorAll('.gist-editor-form .CodeMirror')[${index}].CodeMirror.setValue(${JSON.stringify(value)})`)
  await pause(60)
}
async function shortcut (key, modifiers = [process.platform === 'darwin' ? 'meta' : 'control']) {
  window.focus()
  if (key !== 'Escape') {
    // sendInputEvent does not dispatch macOS application-menu accelerators.
    // Exercise the real menu command; OS shortcut delivery is a separate check.
    const accelerator = key === 'Space' ? 'Shift+Space' : `CommandOrControl+${key}`
    const items = Menu.getApplicationMenu().items.flatMap(item => item.submenu ? item.submenu.items : [])
    const item = items.find(item => item.accelerator === accelerator)
    assert.ok(item, `Missing application command ${accelerator}`)
    item.click(item, window)
    await pause(250)
    return
  }
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers })
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers })
  await pause(250)
}
async function screenshot (name) {
  fs.writeFileSync(path.join(artifacts, `${name}.png`), (await window.webContents.capturePage()).toPNG())
}
function passed (name) { console.log(`PASS UI: ${name}`) }
async function list () { return request(op.LIST_SNIPPETS, 'lepton_integration') }
async function details (id) { return request(op.GET_SNIPPET, id) }
async function select (name) { await textClick('.snippet-thumnail-description', name); await visible('.snippet-box') }
async function closeModal () { await click('.modal .close') }
async function login () {
  await visible('[aria-label="GitLab personal access token"]')
  await input('[aria-label="GitLab personal access token"]', token)
  await click('.login-modal button[type=submit]')
  await visible('.active-layout')
}
async function run () {
  await until(async () => {
    window = BrowserWindow.getAllWindows().find(w => !w.getParentWindow())
    return window && !window.webContents.isLoading()
  }, 'main window')
  window.webContents.on('render-process-gone', (_, detail) => failures.push(detail.reason))
  window.webContents.on('console-message', event => {
    if (event.level === 'error' || event.level === 3) failures.push(event.message)
  })
  if (phase === 'restart') {
    step = 'cached login after full restart'
    await visible('.active-layout')
    assert.equal(await evaluate("window.lepton.config.get('theme')"), 'dark')
    assert.equal(await evaluate("window.lepton.config.get('snippet:downloadAll')"), false)
    await select('E2E edited')
    await until(() => evaluate("document.body.innerText.includes('External synchronized content')"), 'content after restart')
    assert.ok(await evaluate("[...document.querySelectorAll('.pinned-tag-header + .tag-section-content a')].some(e => e.innerText.trim() === '#updated')"))
    passed('cached login, lazy file loading, theme and pinned tags after full app restart')
    await textClick('.user-panel-button', 'New')
    await visible('.new-gist-draft-callout')
    await textClick('.new-gist-draft-actions button', 'Load draft')
    assert.equal(await evaluate("document.querySelector('.gist-editor-input-area').value"), '[Draft] local only')
    assert.equal(await evaluate("document.querySelector('.CodeMirror').CodeMirror.getValue()"), 'draft recovery text')
    await textClick('.gist-editor-form button', 'Cancel')
    passed('failed-save draft recovery after full app restart')
    step = 'delete confirmation'
    await click('.snippet-control[title="Delete"]')
    await textClick('.modal button', 'Cancel')
    assert.ok((await list()).some(s => s.providerTitle === 'E2E edited'))
    await click('.snippet-control[title="Delete"]')
    await click('.modal-footer .btn-danger')
    await until(async () => !(await list()).some(s => s.providerTitle === 'E2E edited'), 'server deletion')
    passed('delete cancellation and confirmed server deletion')
    step = 'logout and login'
    await textClick('.user-panel-button', 'Logout')
    await click('.logout-modal .btn-danger')
    await visible('.login-modal')
    await input('[aria-label="GitLab personal access token"]', 'invalid-e2e-token')
    await click('.login-modal button[type=submit]')
    await until(() => evaluate("document.body.innerText.includes('Token invalid') && !document.querySelector('.active-layout')"), 'invalid token rejected')
    await login()
    await select('Remote sync')
    passed('logout, invalid-token rejection, token login recovery, and resync')
    await screenshot('live-gitlab-session-recovery')
    assert.deepEqual(failures, [])
    app.exit(0)
    return
  }
  step = 'real token login'
  await login()
  passed('real token login through renderer and preload bridge')
  await textClick('.user-panel-button', 'New')
  await visible('.gist-editor-form')
  step = 'private multi-file creation'
  await input('.gist-editor-input-area', '[E2E private] Description #e2e #markdown')
  await input('.gist-editor-filename-area', 'README.md')
  await code(0, '# Live GitLab\n\n- [ ] Verify task\n\nSearchneedle café 日本語\n')
  await textClick('.gist-editor-customized-tag', '#add file')
  await input('.gist-editor-filename-area', 'src/hello.js', 1)
  await code(1, 'console.log("hello live GitLab")\n')
  assert.equal(await evaluate("document.querySelector('[name=private]').checked"), true)
  await click('.gist-editor-form button[type=submit]')
  await until(async () => (await list()).some(s => s.providerTitle === 'E2E private'), 'private creation on GitLab')
  const item = (await list()).find(s => s.providerTitle === 'E2E private')
  await until(() => evaluate("!document.querySelector('.gist-editor-form')"), 'create editor closed after save')
  await until(async () => Boolean((await details(item.id)).files['src/hello.js']), 'created files committed')
  assert.equal(item.visibility, 'private')
  assert.equal((await details(item.id)).files['src/hello.js'].content, 'console.log("hello live GitLab")\n')
  await select('E2E private')
  await until(() => evaluate("document.body.innerText.includes('Searchneedle')"), 'markdown rendering')
  assert.ok(await evaluate("!!document.querySelector('.code-area .hljs-string')"))
  passed('private multi-file creation, nested paths, Markdown and syntax highlighting')
  step = 'task list and raw/copy/share'
  await click('.task-list-item-checkbox')
  await until(async () => (await details(item.id)).files['README.md'].content.includes('[x]'), 'task toggle save')
  assert.equal((await details(item.id)).files['src/hello.js'].content, 'console.log("hello live GitLab")\n')
  await until(async () => {
    await evaluate("[...document.querySelectorAll('.file-header-control')].find(e=>e.innerText==='COPY').click()")
    return clipboard.readText().includes('[x]')
  }, 'updated task content in renderer')
  assert.ok(clipboard.readText().includes('Live GitLab'))
  await evaluate("[...document.querySelectorAll('.file-header-control')].find(e=>e.innerText==='SHARE').click()")
  assert.ok(clipboard.readText().startsWith(baseUrl))
  await evaluate("[...document.querySelectorAll('.file-header-control')].find(e=>e.innerText==='RAW').click()")
  await visible('.raw-modal')
  assert.ok(await evaluate("document.querySelector('.raw-modal textarea').value.includes('[x]')"))
  await closeModal()
  assert.ok(await evaluate(`document.querySelector('.snippet-control[title="Open in Web"]').href.startsWith(${JSON.stringify(baseUrl)})`))
  passed('task checkbox saves, untouched file preservation, raw view, copy and GitLab links')
  step = 'editing files and metadata'
  await click('.snippet-control[title="Edit"]')
  await visible('.gist-editor-form')
  await input('.gist-editor-input-area', '[E2E edited] Updated #e2e #updated')
  await input('.gist-editor-filename-area', 'src/renamed.js', 1)
  await code(1, 'console.log("renamed")\n')
  await textClick('.gist-editor-customized-tag', '#add file')
  await input('.gist-editor-filename-area', 'notes.txt', 2)
  await code(2, 'new file content')
  await click('.gist-editor-form button[type=submit]')
  await until(async () => (await details(item.id)).providerTitle === 'E2E edited', 'edited metadata')
  await until(async () => Boolean((await details(item.id)).files['src/renamed.js']), 'edited files committed')
  assert.deepEqual(Object.keys((await details(item.id)).files).sort(), ['README.md', 'notes.txt', 'src/renamed.js'])
  await select('E2E edited')
  passed('title, description, tag edits, file rename and new file')
  step = 'file removal and public creation'
  await click('.snippet-control[title="Edit"]')
  await visible('.gist-editor-form')
  await evaluate("[...document.querySelectorAll('.gist-editor-gist-file')].find(e => e.querySelector('input').value === 'src/renamed.js').querySelector('.gist-editor-customized-tag').click()")
  await click('.gist-editor-form button[type=submit]')
  await until(async () => Object.keys((await details(item.id)).files).length === 2, 'removed file persisted')
  await textClick('.user-panel-button', 'New')
  await visible('.gist-editor-form')
  await input('.gist-editor-input-area', '[Public UI] visibility test #public')
  await input('.gist-editor-filename-area', 'public.txt')
  await code(0, 'public visibility test')
  await click('[name=private]')
  await click('.gist-editor-form button[type=submit]')
  await until(() => evaluate("!document.querySelector('.gist-editor-form')"), 'public create completed')
  assert.equal((await list()).find(s => s.providerTitle === 'Public UI').public, true)
  await select('E2E edited')
  passed('file removal and public snippet creation through UI')
  step = 'search'
  for (const query of ['E2E edited', 'Searchneedle']) {
    await shortcut('Space', ['shift'])
    await visible('.search-box')
    await input('.search-box', query)
    await evaluate("document.querySelector('.search-box').dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }))")
    await until(() => evaluate("document.querySelector('.result-group').innerText.includes('E2E edited')"), `search ${query}`)
    await shortcut('Escape', [])
    await until(() => evaluate("!document.querySelector('.search-box')"), 'search closed')
  }
  passed('metadata and downloaded-content search')
  step = 'tags and pins'
  await textClick('.gist-tag, .active-gist-tag', '#updated')
  assert.ok(await evaluate("document.querySelector('.snippet-thumnail-description').innerText==='E2E edited'"))
  await click('.configure-tag')
  await visible('.pinned-tags-modal')
  await textClick('.pin-tag-item a', '#updated')
  await textClick('.pinned-tags-modal button', 'Save')
  await textClick('.active-gist-tag', '#updated')
  await textClick('.gist-tag, .active-gist-tag', '#All')
  passed('tag filtering and pinning')
  step = 'external updates and sync'
  await request(op.CREATE_SNIPPET, '[Remote sync] external #remote', { 'remote.txt': { content: 'from GitLab API' } }, true)
  await request(op.UPDATE_SNIPPET, item.id, '[E2E edited] Updated #e2e #updated', { 'notes.txt': { content: 'External synchronized content' } })
  await textClick('.user-panel-button', 'Sync')
  await until(() => evaluate("[...document.querySelectorAll('.snippet-thumnail-description')].some(e=>e.innerText==='Remote sync')"), 'external snippet synchronized')
  await select('E2E edited')
  await until(() => evaluate("document.body.innerText.includes('External synchronized content')"), 'remote edit synchronized')
  passed('sync imports external creation and file edits')
  step = 'notebook and AsciiDoc rendering'
  const notebook = JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { language_info: { name: 'python' } },
    cells: [
      { cell_type: 'markdown', metadata: {}, source: ['# Live notebook'] },
      { cell_type: 'code', metadata: {}, execution_count: 1, source: ['print(42)'], outputs: [{ output_type: 'stream', name: 'stdout', text: ['42'] }] }
    ]
  })
  await request(op.CREATE_SNIPPET, '[Rich formats] render checks', {
    'demo.ipynb': { content: notebook }, 'demo.adoc': { content: '= Live AsciiDoc\n\n*bold content*' }
  }, false)
  await textClick('.user-panel-button', 'Sync')
  await until(() => evaluate("[...document.querySelectorAll('.snippet-thumnail-description')].some(e=>e.innerText==='Rich formats')"), 'rich formats synced')
  await select('Rich formats')
  await visible('.nb-notebook')
  await visible('.asciidoc-section strong')
  assert.ok(await evaluate("document.querySelector('.nb-notebook').innerText.includes('42')"))
  await screenshot('live-gitlab-rich-formats')
  passed('Jupyter notebook output and AsciiDoc rendering from GitLab')
  await select('E2E edited')
  step = 'dashboard, settings and immersive mode'
  await shortcut('D')
  await visible('.dashboard-modal canvas')
  await closeModal()
  await shortcut(',')
  await visible('.about-modal')
  await evaluate(`(() => {
    const select = [...document.querySelectorAll('.preference-row')].find(e => e.querySelector('span').innerText === 'Theme').querySelector('select')
    select.value = 'dark'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  await evaluate("[...document.querySelectorAll('.preference-checkbox')].find(e => e.innerText === 'Download all snippets for content search').querySelector('input').click()")
  await textClick('.about-modal button', 'Save')
  await until(() => evaluate("!document.querySelector('.about-modal') && window.lepton.config.get('theme') === 'dark'"), 'theme preference saved')
  await shortcut('I')
  await visible('.snippet-panel-immersive')
  await shortcut('I')
  await until(() => evaluate("!document.querySelector('.snippet-panel-immersive')"), 'immersive off')
  passed('dashboard, saved preferences and immersive mode via app menu commands')
  await screenshot('live-gitlab-edited-snippet')
  await select('Remote sync')
  assert.equal((await list()).find(s => s.providerTitle === 'Remote sync').public, true)
  passed('public snippet rendering')
  step = 'failed-save draft recovery'
  await textClick('.user-panel-button', 'New')
  await visible('.gist-editor-form')
  await input('.gist-editor-input-area', '[Draft] local only')
  await input('.gist-editor-filename-area', 'draft.txt')
  await code(0, 'draft recovery text')
  // Electron's callback accepts a response object, not a Node-style error.
  // eslint-disable-next-line node/no-callback-literal
  window.webContents.session.webRequest.onBeforeRequest({ urls: [baseUrl + '/api/v4/snippets'] }, (_, callback) => callback({ cancel: true }))
  await click('.gist-editor-form button[type=submit]')
  await visible('.new-gist-draft-callout')
  window.webContents.session.webRequest.onBeforeRequest(null)
  await textClick('.gist-editor-form button', 'Cancel')
  assert.ok(!(await list()).some(s => s.providerTitle === 'Draft'))
  passed('failed network save preserves local draft without creating a server snippet')
  assert.deepEqual(failures, [])
  app.exit(0)
}
app.whenReady().then(run).catch(async error => {
  console.error(`FAIL UI during ${step}: ${error.message}`)
  if (window && !window.isDestroyed()) {
    await screenshot('failure')
    console.error((await evaluate('document.body.innerText')).slice(0, 6000))
  }
  app.exit(1)
})
