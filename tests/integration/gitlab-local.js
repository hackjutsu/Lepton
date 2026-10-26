const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const net = require('node:net')
const { verifyGitLabApi } = require('./gitlab-api-live')

const container = `lepton-gitlab-test-${randomUUID()}`
const image = process.env.LEPTON_GITLAB_TEST_IMAGE || 'gitlab/gitlab-ce:latest'
let started = false

function docker (args, input) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout: 300000, maxBuffer: 8 * 1024 * 1024 })
  // Do not print Docker exec output: it can contain the generated test token.
  if (result.error || result.status !== 0) {
    throw new Error(`Docker ${args[0]} failed (status ${result.status}); check Docker availability and resources.`)
  }
  return result.stdout.trim()
}

function cleanup () {
  if (!started) return
  docker(['rm', '--force', '--volumes', container])
  started = false
  console.log('Removed disposable GitLab container and its anonymous volumes')
}

function freePort () {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

async function main () {
  docker(['info', '--format', '{{.ServerVersion}}'])
  assert.match(image, /^gitlab\/gitlab-ce:[a-zA-Z0-9._-]+$/, 'Use an official GitLab CE image tag')
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`Starting disposable GitLab at ${baseUrl} using ${image}`)
  const configuration = [
    `external_url '${baseUrl}'`,
    "nginx['listen_port'] = 80",
    "letsencrypt['enable'] = false",
    "prometheus_monitoring['enable'] = false",
    "gitlab_rails['smtp_enable'] = false",
    "gitlab_rails['usage_ping_enabled'] = false",
    "puma['worker_processes'] = 2",
    "sidekiq['concurrency'] = 5"
  ].join('; ')

  try {
    docker(['create', '--platform', 'linux/amd64', '--name', container, '--publish', `127.0.0.1:${port}:80`,
      '--shm-size', '256m', '--memory', '6g', '--cpus', '4',
      '--env', `GITLAB_OMNIBUS_CONFIG=${configuration}`, image])
    started = true
    docker(['start', container])
    console.log(`Image ID: ${docker(['inspect', '--format', '{{.Image}}', container])}`)
    const deadline = Date.now() + 12 * 60 * 1000
    let ready = false
    while (Date.now() < deadline) {
      try {
        // GitLab restricts monitoring endpoints to loopback by default. Check
        // inside the container rather than widening its monitoring allowlist.
        const response = JSON.parse(docker(['exec', container, 'curl', '--fail', '--silent',
          '--max-time', '5', 'http://127.0.0.1/-/readiness?all=1']))
        if (response.status === 'ok') { ready = true; break }
      } catch {}
      console.log('Waiting for GitLab services...')
      await new Promise(resolve => setTimeout(resolve, 15000))
    }
    assert.ok(ready, 'GitLab did not become ready within 12 minutes')

    const token = docker(['exec', '-i', container, 'gitlab-rails', 'runner', '-'], `
require 'securerandom'
password = SecureRandom.hex(32)
Users::CreateService.new(User.find_by(admin: true), username: 'lepton_integration', name: 'Lepton Integration', email: 'lepton@example.invalid', password: password, password_confirmation: password, organization_id: Organizations::Organization.first.id, skip_confirmation: true, admin: false).execute
user = User.find_by!(username: 'lepton_integration')
token = user.personal_access_tokens.create!(name: 'Disposable Lepton verification', scopes: ['api'], expires_at: Date.tomorrow)
puts token.token
`).split('\n').at(-1).trim()
    assert.ok(token, 'GitLab did not generate a test token')
    await verifyGitLabApi({ baseUrl, token })
    console.log('Live GitLab API verification passed')
    if (process.argv.includes('--ui')) {
      await require('./gitlab-ui')({ baseUrl, token })
    }
  } finally {
    cleanup()
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    try { cleanup() } finally { process.exit(signal === 'SIGINT' ? 130 : 143) }
  })
}

main().catch(error => {
  // Error objects from HTTP can contain response data. Report only a bounded
  // summary, never a token, response body, environment, or request headers.
  console.error(`GitLab integration failed: ${error.name}${error.statusCode ? ` (HTTP ${error.statusCode})` : ''}`)
  if (!started && !error.statusCode) console.error('Requires Docker with an amd64 Linux engine, 6 GiB available memory, and network access to the official GitLab image.')
  process.exitCode = 1
})
