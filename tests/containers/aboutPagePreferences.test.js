import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  configGet: vi.fn(),
  configSet: vi.fn(),
  configSetForRestart: vi.fn()
}))

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: {
      get: mocks.configGet,
      set: mocks.configSet,
      setForRestart: mocks.configSetForRestart
    },
    dialog: {
      showMessage: vi.fn(() => Promise.resolve())
    },
    files: {
      ensureConfigFile: vi.fn(() => Promise.resolve())
    },
    globals: {
      getPaths: () => ({ configFilePath: '/tmp/.leptonrc', logFilePath: '/tmp/lepton.log' })
    },
    shell: {
      openPath: vi.fn()
    }
  }
}))

vi.mock('../../app/utilities/themeManager', () => ({
  default: class ThemeManager {
    setTheme () {}
  },
  isDarkTheme: () => false
}))

vi.mock('../../app/utilities/i18n', () => ({
  getSupportedLocales: () => [{ code: 'en', name: 'English' }],
  t: key => key
}))

vi.mock('../../.all-contributorsrc', () => ({
  default: { contributors: [] }
}))

import ConnectedAboutPage from '../../app/containers/aboutPage'

const AboutPage = ConnectedAboutPage.WrappedComponent

function useSynchronousState (component) {
  component.setState = update => {
    const nextState = typeof update === 'function'
      ? update(component.state, component.props)
      : update
    component.state = { ...component.state, ...nextState }
  }
}

describe('AboutPage preference persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.configGet.mockImplementation(key => {
      if (key === 'provider:type') return 'github'
      if (key === 'gitlab:host') return 'gitlab.com'
      return undefined
    })
  })

  it('writes nothing when any changed preference is invalid', async () => {
    const page = new AboutPage({ aboutModalStatus: 'ON', updateAboutModalStatus: vi.fn() })
    useSynchronousState(page)
    page.state.values = {
      ...page.state.values,
      'provider:type': 'gitlab',
      'gitlab:host': ''
    }

    await page.applyPreferences(false)

    expect(mocks.configSet).not.toHaveBeenCalled()
    expect(mocks.configSetForRestart).not.toHaveBeenCalled()
    expect(page.state.saving).toBe(false)
    expect(page.state.error).toBe('Could not save preferences to .leptonrc.')
  })

  it('does not activate GitLab when the unchanged saved host is invalid', async () => {
    mocks.configGet.mockImplementation(key => {
      if (key === 'provider:type') return 'github'
      if (key === 'gitlab:host') return ''
      return undefined
    })
    const page = new AboutPage({ aboutModalStatus: 'ON', updateAboutModalStatus: vi.fn() })
    useSynchronousState(page)
    page.state.values = { ...page.state.values, 'provider:type': 'gitlab' }

    await page.applyPreferences(false)

    expect(mocks.configSet).not.toHaveBeenCalled()
    expect(mocks.configSetForRestart).not.toHaveBeenCalled()
    expect(page.state.error).toBe('Could not save preferences to .leptonrc.')
  })

  it('does not enable GitHub Enterprise with an empty saved host', async () => {
    const page = new AboutPage({ aboutModalStatus: 'ON', updateAboutModalStatus: vi.fn() })
    useSynchronousState(page)
    page.state.values = {
      ...page.state.values,
      'enterprise:enable': true,
      'enterprise:host': ''
    }

    await page.applyPreferences(false)

    expect(mocks.configSet).not.toHaveBeenCalled()
    expect(mocks.configSetForRestart).not.toHaveBeenCalled()
  })
})
