import { describe, expect, it } from 'vitest'
import githubApiCore from '../../app/utilities/githubApi/core'
import gitlabApiCore from '../../app/utilities/gitlabApi/core'
import operations from '../../app/utilities/snippetApi/operations'

const { GET_ALL_GISTS_V1, createGitHubApi } = githubApiCore
const { createGitLabApi } = gitlabApiCore
const fetchImpl = () => Promise.resolve({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: {},
  text: () => Promise.resolve('{}')
})
const {
  CREATE_SNIPPET,
  CREATE_SINGLE_GIST,
  DELETE_SNIPPET,
  DELETE_SINGLE_GIST,
  EDIT_SINGLE_GIST,
  EXCHANGE_ACCESS_TOKEN,
  GET_ALL_GISTS,
  GET_SINGLE_GIST,
  GET_SNIPPET,
  GET_USER_PROFILE,
  LIST_SNIPPETS,
  UPDATE_SNIPPET
} = operations

const commonOperations = [
  LIST_SNIPPETS,
  GET_SNIPPET,
  GET_USER_PROFILE,
  CREATE_SNIPPET,
  UPDATE_SNIPPET,
  DELETE_SNIPPET
]

describe('snippet provider API contract', () => {
  it.each([
    ['github', () => createGitHubApi({ fetchImpl })],
    ['gitlab', () => createGitLabApi({ fetchImpl })]
  ])('%s exposes the shared request interface', (type, createProvider) => {
    const provider = createProvider()

    expect(provider.type).toBe(type)
    expect(provider.getRequest).toEqual(expect.any(Function))
    commonOperations.forEach(operation => {
      expect(provider.getRequest(operation)).toEqual(expect.any(Function))
    })
    expect(provider.getRequest('UNKNOWN_SNIPPET_OPERATION')).toBeUndefined()
  })

  it('supports OAuth exchange only for GitHub', () => {
    expect(createGitHubApi({ fetchImpl }).getRequest(EXCHANGE_ACCESS_TOKEN)).toEqual(expect.any(Function))
    expect(createGitLabApi({ fetchImpl }).getRequest(EXCHANGE_ACCESS_TOKEN)).toBeUndefined()
  })

  it('keeps the legacy paginated-list operation as a GitHub-only extension', () => {
    expect(createGitHubApi({ fetchImpl }).getRequest(GET_ALL_GISTS_V1)).toEqual(expect.any(Function))
    expect(createGitLabApi({ fetchImpl }).getRequest(GET_ALL_GISTS_V1)).toBeUndefined()
  })

  it('keeps legacy operation aliases on their existing wire values', () => {
    expect({
      CREATE_SNIPPET,
      DELETE_SNIPPET,
      GET_SNIPPET,
      LIST_SNIPPETS,
      UPDATE_SNIPPET
    }).toEqual({
      CREATE_SNIPPET: 'CREATE_SINGLE_GIST',
      DELETE_SNIPPET: 'DELETE_SINGLE_GIST',
      GET_SNIPPET: 'GET_SINGLE_GIST',
      LIST_SNIPPETS: 'GET_ALL_GISTS',
      UPDATE_SNIPPET: 'EDIT_SINGLE_GIST'
    })
    expect(CREATE_SINGLE_GIST).toBe(CREATE_SNIPPET)
    expect(DELETE_SINGLE_GIST).toBe(DELETE_SNIPPET)
    expect(EDIT_SINGLE_GIST).toBe(UPDATE_SNIPPET)
    expect(GET_ALL_GISTS).toBe(LIST_SNIPPETS)
    expect(GET_SINGLE_GIST).toBe(GET_SNIPPET)
  })
})
