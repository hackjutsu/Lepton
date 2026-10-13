import { getSnippetApi, getSnippetProvider } from '../snippetApi'
import githubOperations from './operations'

export const GET_ALL_GISTS_V1 = githubOperations.GET_ALL_GISTS_V1

export {
  EXCHANGE_ACCESS_TOKEN,
  GET_ALL_GISTS,
  GET_SINGLE_GIST,
  GET_USER_PROFILE,
  CREATE_SINGLE_GIST,
  EDIT_SINGLE_GIST,
  DELETE_SINGLE_GIST
} from '../snippetApi'

export function getGitHubApi (selection) {
  const activeProvider = getSnippetProvider()
  const githubProvider = activeProvider.type === 'github'
    ? activeProvider
    : { type: 'github' }

  return getSnippetApi(selection, githubProvider)
}
