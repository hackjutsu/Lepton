// Provider credentials are held in memory only. Never serialize this object.
export const session = { mode: 'local', base: '', token: '' }

export async function requestProvider (invoke, operation, args = [], state = session) {
  const actions = {
    GET_USER_PROFILE: ['profile', () => []],
    GET_ALL_GISTS: ['list', () => []],
    GET_SINGLE_GIST: ['get', values => [values[1]]],
    CREATE_SINGLE_GIST: ['create', values => values.slice(1, 4)],
    EDIT_SINGLE_GIST: ['update', values => values.slice(1, 4)],
    DELETE_SINGLE_GIST: ['delete', values => [values[1]]]
  }
  const entry = actions[operation]
  if (!entry) throw new Error('Unsupported GitLab operation')
  return invoke(state.mode === 'github' ? 'github_request' : 'gitlab_request', { base: state.base, token: state.token, operation: entry[0], args: entry[1](args) })
}
