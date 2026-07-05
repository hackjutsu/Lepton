const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const electronPath = require('electron')

const repoRoot = path.resolve(__dirname, '../..')
const bundlePath = path.join(repoRoot, 'bundle', 'app.bundle.js')
const smokeMainPath = path.join(__dirname, 'electron-login-flow-smoke-main.js')

const transparentGif = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

const scenarios = [
  {
    name: 'oauth-success'
  },
  {
    name: 'oauth-denied-retry'
  },
  {
    name: 'oauth-exchange-failure-retry'
  },
  {
    name: 'manual-token-success'
  },
  {
    name: 'manual-token-invalid'
  },
  {
    name: 'cached-token-success',
    cachedUserInfo: {
      profile: 'cached-user',
      token: 'cached-good-token'
    }
  },
  {
    name: 'cached-token-invalid',
    cachedUserInfo: {
      profile: 'cached-user',
      token: 'cached-bad-token'
    }
  }
]

function assertBuiltBundleExists () {
  if (!fs.existsSync(bundlePath)) {
    throw new Error('Missing bundle/app.bundle.js. Run `npm run test:build` before the login-flow smoke test.')
  }
}

function createTempHome (scenario) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lepton-login-flow-'))
  const configHome = path.join(root, 'config')
  const userData = path.join(root, 'user-data')
  fs.mkdirSync(configHome, { recursive: true })
  fs.mkdirSync(userData, { recursive: true })
  fs.writeFileSync(path.join(configHome, '.leptonrc'), JSON.stringify({
    autoUpdate: false,
    i18n: {
      locale: 'en'
    },
    logger: {
      level: 'error'
    },
    notifications: {
      failure: true,
      success: false
    },
    security: {
      cachedAccessTokenStorage: 'file'
    }
  }))

  if (scenario.cachedUserInfo) {
    seedCachedUserInfo(userData, scenario.cachedUserInfo)
  }

  return { configHome, root, userData }
}

function seedCachedUserInfo (userData, cachedUserInfo) {
  const storageDir = path.join(userData, 'storage')
  fs.mkdirSync(storageDir, { recursive: true })
  writeStorageValue(storageDir, 'profile', cachedUserInfo.profile)
  writeStorageValue(storageDir, 'token', cachedUserInfo.token)
}

function writeStorageValue (storageDir, key, value) {
  const fileName = path.basename(key, '.json') + '.json'
  fs.writeFileSync(path.join(storageDir, encodeURIComponent(fileName)), JSON.stringify(value), 'utf8')
}

function createProfile (login) {
  return {
    login,
    id: login.length,
    avatar_url: transparentGif,
    type: 'User'
  }
}

function extractAuthToken (request) {
  const authorization = request.headers.authorization || ''
  const match = authorization.match(/^token\s+(.+)$/)
  return match ? match[1] : ''
}

function getAuthorizeRedirect (scenarioName, authorizeCount, baseUrl) {
  if (scenarioName === 'oauth-denied-retry' && authorizeCount === 1) {
    return `${baseUrl}/oauth/callback?error=access_denied&error_description=denied`
  }

  if (scenarioName === 'oauth-exchange-failure-retry' && authorizeCount === 1) {
    return `${baseUrl}/oauth/callback?code=exchange-failure-code`
  }

  return `${baseUrl}/oauth/callback?code=oauth-success-code`
}

function readRequestBody (request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', chunk => {
      body += chunk
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function writeJson (response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, Object.assign({
    'content-type': 'application/json'
  }, headers))
  response.end(JSON.stringify(body))
}

function writeRedirect (response, location) {
  response.writeHead(302, {
    location
  })
  response.end()
}

function startMockGitHubServer (scenario) {
  return new Promise((resolve, reject) => {
    const requests = []
    let authorizeCount = 0
    let baseUrl = ''

    const server = http.createServer(async (request, response) => {
      const url = new URL(request.url, baseUrl)
      requests.push({
        method: request.method,
        pathname: url.pathname
      })

      try {
        if (url.pathname === '/login/oauth/authorize') {
          authorizeCount += 1
          writeRedirect(response, getAuthorizeRedirect(scenario.name, authorizeCount, baseUrl))
          return
        }

        if (url.pathname === '/login/oauth/access_token') {
          const form = new URLSearchParams(await readRequestBody(request))
          const code = form.get('code')
          if (code === 'exchange-failure-code') {
            writeJson(response, 200, {
              error: 'bad_verification_code',
              error_description: 'The OAuth code was rejected by the mock service.'
            })
            return
          }

          writeJson(response, 200, {
            access_token: 'oauth-token',
            scope: 'gist',
            token_type: 'bearer'
          })
          return
        }

        if (url.pathname === '/api/user') {
          const token = extractAuthToken(request)
          const profiles = {
            'cached-good-token': 'cached-user',
            'manual-good-token': 'manual-user',
            'oauth-token': 'oauth-user'
          }

          if (!profiles[token]) {
            writeJson(response, 401, {
              message: 'Bad credentials',
              documentation_url: 'https://docs.github.com/rest',
              status: '401'
            }, {
              'x-github-request-id': 'LOGIN-FLOW-MOCK'
            })
            return
          }

          writeJson(response, 200, createProfile(profiles[token]))
          return
        }

        if (url.pathname === '/api/gists' || /^\/api\/users\/[^/]+\/gists$/.test(url.pathname)) {
          const token = extractAuthToken(request)
          if (!token || token.endsWith('bad-token')) {
            writeJson(response, 401, {
              message: 'Bad credentials',
              documentation_url: 'https://docs.github.com/rest',
              status: '401'
            })
            return
          }

          writeJson(response, 200, [])
          return
        }

        writeJson(response, 404, {
          message: `Unhandled mock route: ${request.method} ${url.pathname}`
        })
      } catch (error) {
        writeJson(response, 500, {
          message: error.message
        })
      }
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      baseUrl = `http://127.0.0.1:${address.port}`
      resolve({
        baseUrl,
        close: () => new Promise((resolveClose, rejectClose) => {
          server.close(error => error ? rejectClose(error) : resolveClose())
        }),
        requests
      })
    })
  })
}

function runSmokeProcess (tempHome, server, scenario) {
  return new Promise((resolve, reject) => {
    const electronArgs = [
      `--user-data-dir=${tempHome.userData}`,
      smokeMainPath
    ]

    if (process.env.LEPTON_SMOKE_NO_SANDBOX === '1') {
      electronArgs.unshift('--no-sandbox')
    }

    const env = Object.assign({}, process.env, {
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      LEPTON_LOGIN_FLOW_ARTIFACT_DIR: tempHome.root,
      LEPTON_LOGIN_FLOW_SCENARIO: scenario.name,
      LEPTON_TEST_GITHUB_API_BASE_URL: `${server.baseUrl}/api`,
      LEPTON_TEST_GITHUB_OAUTH_ACCESS_TOKEN_URL: `${server.baseUrl}/login/oauth/access_token`,
      LEPTON_TEST_GITHUB_OAUTH_AUTHORIZE_URL: `${server.baseUrl}/login/oauth/authorize`,
      XDG_CONFIG_HOME: tempHome.configHome
    })

    const child = spawn(electronPath, electronArgs, {
      cwd: repoRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`Electron login-flow smoke test timed out for ${scenario.name}.\n${output}`))
    }, 45000)

    child.stdout.on('data', data => {
      const text = data.toString()
      output += text
      process.stdout.write(text)
    })
    child.stderr.on('data', data => {
      const text = data.toString()
      output += text
      process.stderr.write(text)
    })
    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Electron login-flow smoke test failed for ${scenario.name} with exit code ${code} and signal ${signal}.\n${output}`))
    })
  })
}

async function runScenario (scenario) {
  const tempHome = createTempHome(scenario)
  const server = await startMockGitHubServer(scenario)

  try {
    await runSmokeProcess(tempHome, server, scenario)
  } finally {
    await server.close()
  }
}

async function main () {
  assertBuiltBundleExists()

  for (const scenario of scenarios) {
    await runScenario(scenario)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
