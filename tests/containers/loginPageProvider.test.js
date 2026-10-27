import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configValues: {},
  configSet: vi.fn(),
  loggerError: vi.fn()
}))

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: {
      get: key => mocks.configValues[key],
      set: mocks.configSet
    },
    ipc: {
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      send: vi.fn()
    },
    logger: {
      debug: vi.fn(),
      error: mocks.loggerError
    }
  }
}))

import { LoginPage } from '../../app/containers/loginPage'

function useSynchronousState (component) {
  component.setState = update => {
    const nextState = typeof update === 'function'
      ? update(component.state, component.props)
      : update
    component.state = { ...component.state, ...nextState }
  }
}

describe('LoginPage provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configValues = {
      'gitlab:host': 'file:///tmp/invalid-gitlab',
      'provider:type': 'github'
    }
    mocks.configSet.mockImplementation((key, value) => {
      mocks.configValues[key] = value
      return Promise.resolve(value)
    })
  })

  it.each(['', '   '])('does not replace an explicitly blank GitLab host %j with gitlab.com', host => {
    mocks.configValues['gitlab:host'] = host
    mocks.configValues['provider:type'] = 'gitlab'

    const loginPage = new LoginPage({
      authWindowStatus: 'OFF',
      loggedInUserInfo: null,
      provider: { type: 'gitlab', baseUrl: host },
      userSessionStatus: 'INACTIVE'
    })

    expect(loginPage.state.gitlabHost).toBe(host)
    expect(loginPage.state.providerSaveError).toBeTruthy()
  })

  it('rolls persisted provider state back when activation fails', async () => {
    mocks.configValues['gitlab:host'] = 'https://gitlab.example.test'
    const onProviderChange = vi.fn(providerType => {
      if (providerType === 'gitlab') return Promise.reject(new Error('Invalid GitLab host'))
      return Promise.resolve({ type: 'github', baseUrl: 'https://github.com' })
    })
    const loginPage = new LoginPage({
      authWindowStatus: 'OFF',
      loggedInUserInfo: null,
      onProviderChange,
      provider: { type: 'github', baseUrl: 'https://github.com' },
      userSessionStatus: 'INACTIVE'
    })
    useSynchronousState(loginPage)

    await loginPage.handleProviderChanged({ target: { value: 'gitlab' } })

    expect(mocks.configSet).toHaveBeenNthCalledWith(1, 'provider:type', 'gitlab')
    expect(mocks.configSet).toHaveBeenNthCalledWith(2, 'provider:type', 'github')
    expect(onProviderChange).toHaveBeenNthCalledWith(1, 'gitlab')
    expect(onProviderChange).toHaveBeenNthCalledWith(2, 'github')
    expect(mocks.configValues['provider:type']).toBe('github')
    expect(loginPage.state).toMatchObject({
      providerSaving: false,
      providerType: 'github'
    })
  })

  it('keeps an invalid GitLab target selected so its host can be repaired safely', async () => {
    const onProviderChange = vi.fn()
    const loginPage = new LoginPage({
      authWindowStatus: 'OFF',
      loggedInUserInfo: null,
      onProviderChange,
      provider: { type: 'github', baseUrl: 'https://github.com' },
      userSessionStatus: 'INACTIVE'
    })
    useSynchronousState(loginPage)

    await loginPage.handleProviderChanged({ target: { value: 'gitlab' } })

    expect(mocks.configValues['provider:type']).toBe('gitlab')
    expect(onProviderChange).not.toHaveBeenCalled()
    expect(loginPage.state.providerType).toBe('gitlab')
    expect(loginPage.state.providerSaving).toBe(false)
    expect(loginPage.state.providerSaveError).toBeTruthy()
  })

  it('keeps a failed cached GitLab credential ignored when its cache object is reread', () => {
    mocks.configValues['gitlab:host'] = 'https://gitlab.example.test'
    mocks.configValues['provider:type'] = 'gitlab'
    const cachedUserInfo = {
      profile: 'octo',
      provider: { type: 'gitlab', baseUrl: 'https://gitlab.example.test' },
      providerType: 'gitlab',
      token: 'cached-failing-token'
    }
    const loginPage = new LoginPage({
      authWindowStatus: 'OFF',
      loggedInUserInfo: cachedUserInfo,
      provider: { type: 'gitlab', baseUrl: 'https://gitlab.example.test' },
      userSessionStatus: 'IN_PROGRESS'
    })
    useSynchronousState(loginPage)

    const inProgressProps = loginPage.props
    loginPage.props = { ...inProgressProps, userSessionStatus: 'INACTIVE' }
    loginPage.componentDidUpdate(inProgressProps)

    expect(loginPage.isCachedCredentialForSelectedProvider()).toBe(false)

    const failedProps = loginPage.props
    loginPage.props = {
      ...failedProps,
      loggedInUserInfo: { ...cachedUserInfo }
    }
    loginPage.componentDidUpdate(failedProps)
    loginPage.updateInputValue({ target: { value: 'replacement-token' } })

    expect(loginPage.isCachedCredentialForSelectedProvider()).toBe(false)
    expect(loginPage.state.inputTokenValue).toBe('replacement-token')

    const rereadProps = loginPage.props
    loginPage.props = {
      ...rereadProps,
      loggedInUserInfo: { ...cachedUserInfo, token: 'new-cached-token' }
    }
    loginPage.componentDidUpdate(rereadProps)

    expect(loginPage.isCachedCredentialForSelectedProvider()).toBe(true)
  })
})
