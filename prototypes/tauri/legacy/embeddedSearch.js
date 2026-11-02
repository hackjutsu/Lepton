import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import OriginalNavigationPanelDetails from '../../../app/containers/navigationPanelDetails/index'
import SearchIndex from '../../../app/utilities/search'
import electronBridge from '../../../app/utilities/electronBridge'
import { descriptionParser } from '../../../app/utilities/parser'
import { currentSearchQuery, setSearchQuery, announceSearchSelection, matchingSearchResults } from './searchHighlights'
import { createDefaultGistFilters } from '../../../app/utilities/gistFilters'
import { getLocale, t } from '../../../app/utilities/i18n'
import { selectGist, fetchSingleGist, updatescrollRequestStatus, updateGistFilters, updateFileExpandStatus } from '../../../app/actions'

const BaseNavigationPanelDetails = OriginalNavigationPanelDetails.WrappedComponent
const clearLabels = { en: 'Clear search', es: 'Borrar búsqueda', fr: 'Effacer la recherche', ja: '検索をクリア', ko: '검색 지우기', tr: 'Aramayı temizle', 'zh-Hans': '清除搜索', 'zh-Hant': '清除搜尋' }

// Search uses the same exact-match index and downloaded-content rules as the
// existing search window, but presents results in the snippet list.
class EmbeddedSearch extends BaseNavigationPanelDetails {
  constructor (props) {
    super(props)
    this.state = { query: currentSearchQuery(), selectedIndex: 0 }
    this.searchNodes = {}
  }

  componentDidMount () {
    SearchIndex.initFuseSearch()
    this.unsubscribeSearch = electronBridge.ipc.on('search-gist', () => {
      if (!this.input?.closest('[inert]')) this.input?.focus()
    })
  }

  componentDidUpdate () {
    super.componentDidUpdate()
  }

  componentWillUnmount () {
    if (this.unsubscribeSearch) this.unsubscribeSearch()
    setSearchQuery('')
  }

  searchResults () {
    return matchingSearchResults(this.state.query, this.props.gists)
  }

  selectSearchResult (id) {
    if (!this.props.gists[id]) return
    const results = this.searchResults()
    const index = results.findIndex(result => result.id === id)
    if (index !== -1) this.setState({ selectedIndex: index })
    const expanded = { ...this.props.fileExpandStatus }
    let changed = false
    for (const match of results[index]?.searchMeta?.matches || []) {
      if (match.key !== 'files.content' || !match.filename) continue
      const key = `${id}-${match.filename}`
      if (expanded[key] !== true) { expanded[key] = true; changed = true }
    }
    if (changed) this.props.updateFileExpandStatus(expanded)
    this.handleClicked(id)
    this.props.updateGistFilters(createDefaultGistFilters())
    announceSearchSelection(id)
  }

  clearSearch () {
    setSearchQuery('')
    this.setState({ query: '', selectedIndex: 0 }, () => this.input?.focus())
  }

  handleSearchKeyDown (event) {
    const results = this.searchResults()
    const index = Math.min(this.state.selectedIndex, Math.max(0, results.length - 1))
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return
      event.preventDefault()
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length
      this.setState({ selectedIndex: next }, () => this.searchNodes[results[next].id]?.scrollIntoView({ block: 'nearest' }))
    } else if (event.key === 'Enter' && results[index]) {
      event.preventDefault()
      this.selectSearchResult(results[index].id)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.clearSearch()
    }
  }

  renderSearchResults (results) {
    if (!results.length) return <li className='snippet-thumnail-list-item snippet-thumnail-empty' role='status'><div className='snippet-thumnail'>{ t('search.noResults') }</div></li>
    const selected = Math.min(this.state.selectedIndex, results.length - 1)
    return results.map((result, index) => {
      const parsed = descriptionParser(result)
      const title = parsed.title || parsed.description || result.filename || result.id
      return <li className='snippet-thumnail-list-item' role='option' aria-selected={ index === selected } id={ `embedded-result-${index}` } key={ result.id }
        ref={ node => { if (node) this.searchNodes[result.id] = node; else delete this.searchNodes[result.id] } }>
        <div className={ `${this.decideSnippetListItemClass(result.id)}${index === selected ? ' embedded-search-selected' : ''}` }
          onClick={ () => this.selectSearchResult(result.id) }>
          <div className='snippet-thumnail-description'>{ title }</div>
          { this.renderSnippetTags(result.id, parsed.customTags) }
        </div>
      </li>
    })
  }

  render () {
    const query = this.state.query.trim()
    const results = this.searchResults()
    const selected = Math.min(this.state.selectedIndex, Math.max(0, results.length - 1))
    return <div className='panel-thumbnails-background embedded-search-panel'>
      <div className='embedded-search-bar' role='search'>
        <div className='embedded-search-control'>
          <svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='10.5' cy='10.5' r='6.5' /><path d='m15.5 15.5 4.5 4.5' /></svg>
          <input ref={ node => { this.input = node } } type='search' className='embedded-search-input' role='combobox'
            aria-label={ t('search.placeholder') } aria-autocomplete='list' aria-expanded={ Boolean(query) }
            aria-controls='embedded-search-results' aria-activedescendant={ query && results.length ? `embedded-result-${selected}` : undefined }
            placeholder={ t('menu.search') } value={ this.state.query }
            onChange={ event => { const value = event.target.value; setSearchQuery(value); this.setState({ query: value, selectedIndex: 0 }) } }
            onKeyDown={ event => this.handleSearchKeyDown(event) } />
          { this.state.query
            ? <button type='button' className='embedded-search-clear' aria-label={ clearLabels[getLocale()] || clearLabels.en }
              title={ clearLabels[getLocale()] || clearLabels.en } onMouseDown={ event => event.preventDefault() } onClick={ () => this.clearSearch() }>
              <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 6l12 12M18 6 6 18' /></svg>
            </button>
            : null }
        </div>
        { query
          ? <div className='embedded-search-count' role='status' aria-live='polite'>
            { results.length === 1 ? t('search.resultCountOne') : t('search.resultCountMany', { count: results.length }) }
          </div>
          : null }
      </div>
      <div className='panel-thumbnails-scroll'><div className='panel-thumbnails-content'>
        <ul id='embedded-search-results' role={ query ? 'listbox' : undefined }>
          { query ? this.renderSearchResults(results) : super.renderSnippetThumbnails() }
        </ul>
      </div></div>
    </div>
  }
}

const mapState = state => ({
  gists: state.gists,
  gistTags: state.gistTags,
  activeGistFilters: state.activeGistFilters,
  activeGist: state.activeGist,
  scrollRequestStatus: state.scrollRequestStatus,
  fileExpandStatus: state.fileExpandStatus
})
const mapDispatch = dispatch => bindActionCreators({ selectGist, fetchSingleGist, updatescrollRequestStatus, updateGistFilters, updateFileExpandStatus }, dispatch)
export default connect(mapState, mapDispatch)(EmbeddedSearch)
