const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { createGitLabApi } = require('../../app/utilities/gitlabApi/core')
const operations = require('../../app/utilities/snippetApi/operations')

// Use the production adapter and real HTTP responses, never a mock provider.
async function verifyGitLabApi ({ baseUrl, token, log = console.log }) {
  assert.ok(token, 'A test credential is required')
  const api = createGitLabApi({
    provider: { type: 'gitlab', baseUrl },
    fetchImpl: fetch
  })
  const request = (operation, ...args) => api.getRequest(operation)(token, ...args)
  const title = `Lepton integration ${randomUUID()}`
  let createdId
  let deleted = false

  try {
    const profile = await request(operations.GET_USER_PROFILE)
    assert.equal(profile.providerType, 'gitlab')
    assert.ok(profile.login)
    log('PASS: authenticated profile and provider identity')

    const created = await request(operations.CREATE_SNIPPET, `[${title}] Test only #lepton-test`, {
      'README.md': { content: '# Test\n- [ ] verify task\n' },
      'src/hello.js': { content: 'console.log("hello")\n' }
    }, false)
    // Record the ID before assertions so failures still clean up this snippet.
    createdId = created.id
    assert.ok(/^\d+$/.test(createdId), 'Expected a GitLab snippet ID')
    assert.equal(created.public, false)
    assert.equal(created.visibility, 'private')
    log('PASS: created a private multi-file snippet')

    const list = await request(operations.LIST_SNIPPETS, profile.login)
    assert.ok(list.some(snippet => snippet.id === createdId))
    let read = await request(operations.GET_SNIPPET, createdId)
    assert.equal(read.files['README.md'].content, '# Test\n- [ ] verify task\n')
    assert.equal(read.files['src/hello.js'].content, 'console.log("hello")\n')
    log('PASS: list, nested file paths, and raw file hydration')

    await request(operations.UPDATE_SNIPPET, createdId, `[${title}] Updated #lepton-test`, {
      'README.md': { content: '# Test\n- [x] verify task\n' }
    })
    read = await request(operations.GET_SNIPPET, createdId)
    assert.equal(read.files['README.md'].content, '# Test\n- [x] verify task\n')
    assert.equal(read.files['src/hello.js'].content, 'console.log("hello")\n')
    log('PASS: task-list update preserves untouched files')

    await request(operations.UPDATE_SNIPPET, createdId, `[${title}] Renamed #lepton-test`, {
      'src/hello.js': null,
      'src/renamed.js': { content: 'console.log("updated")\n' },
      'notes.txt': { content: 'Unicode: 日本語 café\n' }
    })
    read = await request(operations.GET_SNIPPET, createdId)
    assert.deepEqual(Object.keys(read.files).sort(), ['README.md', 'notes.txt', 'src/renamed.js'])
    assert.equal(read.files['src/renamed.js'].content, 'console.log("updated")\n')
    assert.equal(read.files['notes.txt'].content, 'Unicode: 日本語 café\n')
    assert.equal(read.providerDescription, 'Renamed #lepton-test')
    log('PASS: file creation, rename/delete, metadata, and Unicode round-trip')

    await request(operations.DELETE_SNIPPET, createdId)
    deleted = true
    await assert.rejects(request(operations.GET_SNIPPET, createdId), error => error.statusCode === 404)
    assert.ok(!(await request(operations.LIST_SNIPPETS, profile.login)).some(snippet => snippet.id === createdId))
    log('PASS: deletion confirmed by GET and list')
  } finally {
    if (createdId && !deleted) {
      await request(operations.DELETE_SNIPPET, createdId)
      log('Cleaned up the temporary snippet after failure')
    }
  }
}

module.exports = { verifyGitLabApi }
