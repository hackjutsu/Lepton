import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectedSnippet from '../../app/containers/snippet'
import { createDefaultGistFilters } from '../../app/utilities/gistFilters'

const mocks = vi.hoisted(() => ({
  getSnippetApi: vi.fn(),
  notifyFailure: vi.fn(),
  notifySuccess: vi.fn(),
  requestEdit: vi.fn()
}))

vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    clipboard: {
      writeText: vi.fn()
    },
    config: {
      get: () => false
    },
    ipc: {
      on: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn()
    },
    logger: {
      error: vi.fn(),
      info: vi.fn()
    }
  }
}))

vi.mock('../../app/utilities/snippetApi', () => ({
  DELETE_SINGLE_GIST: 'DELETE_SINGLE_GIST',
  EDIT_SINGLE_GIST: 'EDIT_SINGLE_GIST',
  getSnippetApi: mocks.getSnippetApi
}))

vi.mock('../../app/utilities/notifier', () => ({
  notifyFailure: mocks.notifyFailure,
  notifySuccess: mocks.notifySuccess
}))

vi.mock('../../app/containers/gistEditorForm', () => ({
  default: () => null,
  UPDATE_GIST: 'UPDATE_GIST'
}))

vi.mock('../../app/containers/codeArea', () => ({
  default: () => null
}))

const Snippet = ConnectedSnippet.WrappedComponent

describe('Snippet markdown task toggles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSnippetApi.mockReturnValue(mocks.requestEdit)
  })

  it('keeps untouched GitLab file contents after a partial task update', async () => {
    const taskFile = {
      filename: 'tasks.md',
      content: '- [ ] ship GitLab support',
      language: 'Markdown'
    }
    const notesFile = {
      filename: 'notes.md',
      content: 'Do not lose these notes.',
      language: 'Markdown',
      raw_url: 'https://gitlab.example.test/old-notes-raw'
    }
    const activeDetails = {
      id: '42',
      description: '[Tasks] Release checklist',
      providerType: 'gitlab',
      files: {
        'tasks.md': taskFile,
        'notes.md': notesFile
      }
    }
    const activeSnippet = {
      brief: activeDetails,
      details: activeDetails,
      langs: new Set(['Markdown'])
    }
    const editResponse = {
      id: '42',
      description: '[Tasks] Release checklist',
      providerType: 'gitlab',
      files: {
        'tasks.md': {
          filename: 'tasks.md',
          content: '- [x] ship GitLab support',
          language: 'Markdown'
        },
        'notes.md': {
          filename: 'notes.md',
          language: 'Markdown',
          raw_url: 'https://gitlab.example.test/new-notes-raw'
        }
      }
    }
    mocks.requestEdit.mockResolvedValue(editResponse)

    const updateSingleGist = vi.fn()
    const searchIndex = {
      buildSearchRecord: vi.fn(() => ({ id: '42' })),
      updateFuseIndex: vi.fn()
    }
    const snippet = new Snippet({
      accessToken: 'pat-1',
      activeGist: '42',
      activeGistFilters: createDefaultGistFilters(),
      gists: { 42: activeSnippet },
      gistTags: {
        'lang@All': ['42'],
        'lang@Markdown': ['42']
      },
      searchIndex,
      updateGistFilters: vi.fn(),
      updateGistTags: vi.fn(),
      updateSingleGist
    })

    await snippet.handleMarkdownTaskListItemToggle(activeSnippet, taskFile, 0, true)

    expect(mocks.requestEdit).toHaveBeenCalledWith(
      'pat-1',
      '42',
      '[Tasks] Release checklist',
      {
        'tasks.md': {
          content: '- [x] ship GitLab support'
        }
      }
    )
    const storedDetails = updateSingleGist.mock.calls[0][0]['42'].details
    expect(storedDetails.files['tasks.md'].content).toBe('- [x] ship GitLab support')
    expect(storedDetails.files['notes.md']).toEqual(expect.objectContaining({
      content: 'Do not lose these notes.',
      raw_url: 'https://gitlab.example.test/new-notes-raw'
    }))
    expect(searchIndex.buildSearchRecord).toHaveBeenCalledWith(expect.objectContaining({
      details: storedDetails
    }))
    expect(editResponse.files['notes.md']).not.toHaveProperty('content')
  })

  it('submits a prototype-named file as an own edit-map entry', async () => {
    const currentFiles = Object.create(null)
    currentFiles.__proto__ = {
      filename: '__proto__',
      content: 'before',
      language: null
    }
    const details = {
      id: '42',
      description: 'Prototype filename',
      files: currentFiles
    }
    mocks.requestEdit.mockResolvedValue(details)
    const snippet = new Snippet({
      accessToken: 'pat-1',
      activeGist: '42',
      gists: {
        42: {
          brief: details,
          details,
          langs: new Set(['Other'])
        }
      }
    })
    snippet.closeGistEditorModal = vi.fn()
    snippet.updateGistsStoreWithUpdatedGist = vi.fn()

    await snippet.handleGistEditorFormSubmit({
      description: 'Prototype filename',
      gistFiles: [{ filename: '__proto__', content: 'after' }]
    })

    const submittedFiles = mocks.requestEdit.mock.calls[0][3]
    expect(Object.keys(submittedFiles)).toEqual(['__proto__'])
    expect(Object.prototype.hasOwnProperty.call(submittedFiles, '__proto__')).toBe(true)
    expect(submittedFiles.__proto__).toEqual({ content: 'after' })
  })

  it('removes a prototype-named custom tag without reading Object.prototype', () => {
    const currentDetails = {
      id: '42',
      description: '[Prototype] Before #tags: __proto__',
      files: {
        'notes.md': {
          filename: 'notes.md',
          content: 'Safe tags',
          language: 'Markdown'
        }
      }
    }
    const updatedDetails = {
      ...currentDetails,
      description: '[Prototype] After'
    }
    const gistTags = Object.create(null)
    gistTags['lang@All'] = ['42']
    gistTags['lang@Markdown'] = ['42']
    gistTags.__proto__ = ['42']
    const updateGistFilters = vi.fn()
    const updateGistTags = vi.fn()
    const snippet = new Snippet({
      activeGist: '42',
      activeGistFilters: {
        language: 'lang@All',
        tags: ['__proto__']
      },
      gists: {
        42: {
          brief: currentDetails,
          details: currentDetails,
          langs: new Set(['Markdown'])
        }
      },
      gistTags,
      searchIndex: {
        buildSearchRecord: vi.fn(() => ({ id: '42' })),
        updateFuseIndex: vi.fn()
      },
      updateGistFilters,
      updateGistTags,
      updateSingleGist: vi.fn()
    })

    expect(() => snippet.updateGistsStoreWithUpdatedGist(updatedDetails)).not.toThrow()

    const updatedTags = updateGistTags.mock.calls[0][0]
    expect(Object.getPrototypeOf(updatedTags)).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(updatedTags, '__proto__')).toBe(false)
    expect(updateGistFilters).toHaveBeenCalledWith(createDefaultGistFilters())
    expect(Object.prototype.hasOwnProperty.call(gistTags, '__proto__')).toBe(true)
  })
})
