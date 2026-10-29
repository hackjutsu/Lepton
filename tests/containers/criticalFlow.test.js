import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ settings: {}, get: vi.fn() }))
vi.mock('../../app/utilities/electronBridge', () => ({
  default: {
    config: { get: mocks.get },
    logger: { info: vi.fn(), error: vi.fn() },
    ipc: {},
    clipboard: {}
  }
}))
vi.mock('../../app/utilities/snippetApi', () => ({
  getSnippetProvider: () => ({ type: 'github' })
}))

import ConnectedList from '../../app/containers/navigationPanelDetails'
import ConnectedSearch from '../../app/containers/searchPage'
import GistEditorForm from '../../app/containers/gistEditorForm'
import { createDefaultGistFilters } from '../../app/utilities/gistFilters'

const List = ConnectedList.WrappedComponent
const Search = ConnectedSearch.WrappedComponent

function synchronousState (component) {
  component.setState = vi.fn((update, callback) => {
    Object.assign(component.state, typeof update === 'function' ? update(component.state) : update)
    if (callback) callback()
  })
  return component
}

beforeEach(() => {
  mocks.settings = { 'snippet:sorting': 'description', 'snippet:sortingReverse': false }
  mocks.get.mockImplementation(key => mocks.settings[key])
})

describe('everyday snippet navigation', () => {
  function makeList () {
    const ids = Array.from({ length: 100 }, (_, index) => String(index))
    const gists = Object.fromEntries(ids.map(id => [id, {
      brief: { id, description: `[Title ${id.padStart(3, '0')}] #common`, public: false, files: { 'helper.js': {} } }
    }]))
    return new List({ gists, gistTags: { 'lang@All': ids, common: ids }, activeGistFilters: createDefaultGistFilters(), activeGist: '0' })
  }

  it('reads settings per list rather than per row and reuses metadata on selection', () => {
    const list = makeList()
    const entries = list.getSnippetEntries()
    expect(entries).toHaveLength(100)
    expect(mocks.get).toHaveBeenCalledTimes(3)
    list.props = { ...list.props, activeGist: '1' }
    expect(list.getSnippetEntries()).toBe(entries)
    const rows = list.renderSnippetThumbnails()
    expect(rows[0].props.active).toBe(false)
    expect(rows[1].props.active).toBe(true)
  })

  it('refreshes titles, sort preferences, and tags when their inputs change', () => {
    const list = makeList()
    const initial = list.getSnippetEntries()
    mocks.settings['snippet:sortingReverse'] = true
    expect(list.getSnippetEntries()[0].id).toBe('99')
    mocks.settings['tag:showInSnippetList'] = true
    mocks.settings['tag:colored'] = true
    expect(list.getSnippetEntries()[0].tags).toContain('common')
    list.props = { ...list.props, gists: { ...list.props.gists, 99: { brief: { ...list.props.gists[99].brief, description: '[Zebra]' } } } }
    expect(list.getSnippetEntries()[0].title).toBe('Zebra')
    expect(list.getSnippetEntries()).not.toBe(initial)
  })

  it('handles tag entries whose snippets have not arrived during sync', () => {
    const list = makeList()
    list.props = { ...list.props, gists: {} }
    expect(list.getSnippetEntries()).toEqual([])
  })
})

describe('search interaction', () => {
  it('searches once per changed input, including paste, and not on arrow navigation', () => {
    const fuseSearch = vi.fn(() => [{ id: 'a' }, { id: 'b' }])
    const search = synchronousState(new Search({ searchIndex: { fuseSearch } }))
    search.updateInputValue({ target: { value: 'pasted query' } })
    expect(fuseSearch).toHaveBeenCalledExactlyOnceWith('pasted query')
    expect(search.state.inputValue).toBe('pasted query')
    search.handleKeyDown({ keyCode: 40, preventDefault: vi.fn() })
    expect(search.state.selectedIndex).toBe(1)
    expect(fuseSearch).toHaveBeenCalledTimes(1)
    search.updateInputValue({ target: { value: '' } })
    expect(fuseSearch).toHaveBeenCalledTimes(2)
    expect(search.state.selectedIndex).toBe(0)
  })
})

describe('editor input reconciliation', () => {
  it('skips initial-content serialization during typing but still accepts new initial data', () => {
    const initialData = { get description () { return 'Original' }, gists: [{ filename: 'a.js', content: 'original' }] }
    const form = synchronousState(new GistEditorForm({ initialData }))
    const read = vi.spyOn(initialData, 'description', 'get')
    form.componentDidUpdate({ initialData })
    expect(read).not.toHaveBeenCalled()
    form.props = { initialData: { description: 'Replacement', gists: [{ filename: 'b.js', content: 'replacement' }] } }
    form.componentDidUpdate({ initialData })
    expect(form.state.values.description).toBe('Replacement')
    expect(form.state.values.gistFiles[0].content).toBe('replacement')
  })
})
