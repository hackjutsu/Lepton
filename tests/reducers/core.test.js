import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  const logger = {
    debug: () => {},
    error: () => {},
    info: () => {}
  }
  const conf = {
    get: () => false
  }

  return {
    remote: {
      getGlobal: (key) => key === 'logger' ? logger : conf
    }
  }
})

import {
  logoutUserSession,
  removeAccessToken,
  selectGist,
  updateAccessToken,
  updateGists,
  updateGistTags,
  updateSingleGist,
  updateUpdateAvailableBarStatus,
  updateUserSession
} from '../../app/actions'
import activeGist from '../../app/reducers/reducer_active_gist'
import accessToken from '../../app/reducers/reducer_token'
import gistTags from '../../app/reducers/reducer_gist_tags'
import gists from '../../app/reducers/reducer_gists'
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
})
