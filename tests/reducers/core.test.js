import { describe, expect, it, vi } from 'vitest'

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: {
      get: () => false
    },
    logger: {
      debug: () => {},
      error: () => {},
      info: () => {}
    }
  }
}))

import {
  logoutUserSession,
  removeAccessToken,
  selectGist,
  updateAccessToken,
  updateGists,
  updateGistTags,
  updateLoginStatus,
  updateSingleGist,
  updateUpdateAvailableBarStatus,
  updateUserSession
} from '../../app/actions'
import activeGist from '../../app/reducers/reducer_active_gist'
import accessToken from '../../app/reducers/reducer_token'
import gistTags from '../../app/reducers/reducer_gist_tags'
import gists from '../../app/reducers/reducer_gists'
import loginStatus from '../../app/reducers/reducer_login_status'
import updateAvailableBarStatus from '../../app/reducers/reducer_update_available_bar_status'
import userSession from '../../app/reducers/reducer_user_session'

describe('core reducers', () => {
  it('tracks user session status', () => {
    expect(userSession(undefined, { type: '@@INIT' })).toEqual({ activeStatus: 'INACTIVE' })
    expect(userSession(undefined, updateUserSession({ activeStatus: 'ACTIVE', profile: 'octo' })))
      .toEqual({ activeStatus: 'ACTIVE', profile: 'octo' })
    expect(userSession({ activeStatus: 'ACTIVE' }, logoutUserSession()))
      .toEqual({ activeStatus: 'INACTIVE' })
  })

  it('tracks access token lifecycle', () => {
    expect(accessToken(undefined, { type: '@@INIT' })).toBeNull()
    expect(accessToken(null, updateAccessToken('token-1'))).toBe('token-1')
    expect(accessToken('token-1', removeAccessToken())).toBeNull()
  })

  it('tracks gist collection replacement and single-gist updates', () => {
    const initial = {
      a: { id: 'a', description: 'first' }
    }

    expect(gists(undefined, updateGists(initial))).toEqual(initial)
    expect(gists(initial, updateSingleGist({ b: { id: 'b', description: 'second' } })))
      .toEqual({
        a: { id: 'a', description: 'first' },
        b: { id: 'b', description: 'second' }
      })
  })

  it('clears active gist and tags on logout', () => {
    expect(activeGist(null, selectGist('gist-1'))).toBe('gist-1')
    expect(activeGist('gist-1', logoutUserSession())).toBeNull()

    expect(gistTags(undefined, updateGistTags({ JavaScript: 2 }))).toEqual({ JavaScript: 2 })
    expect(gistTags({ JavaScript: 2 }, logoutUserSession())).toBeNull()
  })

  it('tracks update alert visibility', () => {
    expect(updateAvailableBarStatus(undefined, { type: '@@INIT' })).toBe('OFF')
    expect(updateAvailableBarStatus('OFF', updateUpdateAvailableBarStatus('ON'))).toBe('ON')
  })

  it('tracks login status details for authentication feedback', () => {
    expect(loginStatus(undefined, { type: '@@INIT' })).toEqual({
      message: '',
      level: 'info',
      logFilePath: null
    })
    expect(loginStatus(undefined, updateLoginStatus({
      message: 'Exchanging OAuth code for access token...'
    }))).toEqual({
      message: 'Exchanging OAuth code for access token...',
      level: 'info',
      logFilePath: null
    })
    expect(loginStatus(undefined, updateLoginStatus({
      message: 'GitHub sign-in failed.',
      level: 'error',
      logFilePath: '/tmp/lepton.log'
    }))).toEqual({
      message: 'GitHub sign-in failed.',
      level: 'error',
      logFilePath: '/tmp/lepton.log'
    })
    expect(loginStatus({ message: 'old', level: 'error', logFilePath: '/tmp/old.log' },
      updateLoginStatus(null))).toEqual({
      message: '',
      level: 'info',
      logFilePath: null
    })
  })
})
