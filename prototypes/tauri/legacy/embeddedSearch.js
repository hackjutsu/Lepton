import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import OriginalNavigationPanelDetails from '../../../app/containers/navigationPanelDetails/index'
import SearchIndex from '../../../app/utilities/search'
import electronBridge from '../../../app/utilities/electronBridge'
import { descriptionParser } from '../../../app/utilities/parser'
import { createDefaultGistFilters } from '../../../app/utilities/gistFilters'
import { t } from '../../../app/utilities/i18n'
import { selectGist, fetchSingleGist, updatescrollRequestStatus, updateGistFilters } from '../../../app/actions'

const BaseNavigationPanelDetails = OriginalNavigationPanelDetails.WrappedComponent

// Search uses the same exact-match index and downloaded-content rules as the
// existing search window, but presents results in the snippet list.
class EmbeddedSearch extends BaseNavigationPanelDetails {
  constructor (props) {
    super(props)
    this.state = { query: '', selectedIndex: 0 }
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
  }

  searchResults () {
    const query = this.state.query.trim()
    if (!query) return []
    if (!this.cachedSearch || this.cachedSearch.query !== query || this.cachedSearch.gists !== this.props.gists) {
      this.cachedSearch = {
        query,
        gists: this.props.gists,
        results: SearchIndex.fuseSearch(query).filter(result => this.props.gists[result.id])
      }
    }
    return this.cachedSearch.results
  }

  selectSearchResult (id) {
    if (!this.props.gists[id]) return
    const index = this.searchResults().findIndex(result => result.id === id)
    if (index !== -1) this.setState({ selectedIndex: index })
    this.handleClicked(id)
    this.props.updateGistFilters(createDefaultGistFilters())
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
      this.setState({ query: '', selectedIndex: 0 })
      this.input?.blur()
    }
  }

  highlight (text) {
    if (!text) return null
    const tokens = this.state.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const lower = text.toLowerCase()
    const ranges = []
    for (const token of tokens) {
      for (let start = lower.indexOf(token); start !== -1; start = lower.indexOf(token, start + token.length)) {
        ranges.push([start, start + token.length])
      }
    }
    ranges.sort((a, b) => a[0] - b[0])
    const merged = []
    for (const range of ranges) {
      const last = merged[merged.length - 1]
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
      else merged.push(range.slice())
    }
    const output = []
    let offset = 0
    for (const [start, end] of merged) {
      if (start > offset) output.push(text.slice(offset, start))
      output.push(<mark key={ start }>{ text.slice(start, end) }</mark>)
      offset = end
    }
    if (offset < text.length) output.push(text.slice(offset))
    return output
  }

  renderSearchResults (results) {
    if (!results.length) return <li className='snippet-thumnail-list-item snippet-thumnail-empty' role='status'><div className='snippet-thumnail'>{ t('search.noResults') }</div></li>
    const selected = Math.min(this.state.selectedIndex, results.length - 1)
    return results.map((result, index) => {
      const parsed = descriptionParser(result)
      const title = parsed.title || parsed.description || result.filename || result.id
      const contentMatches = (result.searchMeta?.matches || []).filter(match => match.key === 'files.content' && match.excerpt?.segments?.length)
      return <li className='snippet-thumnail-list-item' role='option' aria-selected={ index === selected } id={ `embedded-result-${index}` } key={ result.id }
        ref={ node => { if (node) this.searchNodes[result.id] = node; else delete this.searchNodes[result.id] } }>
        <div className={ `${this.decideSnippetListItemClass(result.id)}${index === selected ? ' embedded-search-selected' : ''}` }
          onClick={ () => this.selectSearchResult(result.id) }>
          <div className='snippet-thumnail-description'>{ this.highlight(title) }</div>
          { parsed.title && parsed.description ? <div className='embedded-search-description'>{ this.highlight(parsed.description) }</div> : null }
          { result.filename ? <div className='embedded-search-filenames'>{ this.highlight(result.filename) }</div> : null }
          { contentMatches.map((match, n) => <div className='embedded-search-excerpt' key={ `${match.filename || 'content'}-${n}` }>
            { contentMatches.length > 1 && match.filename ? <span>{ match.filename }: </span> : null }
            { match.excerpt.segments.map((segment, index) => segment.match ? <mark key={ index }>{ segment.text }</mark> : <React.Fragment key={ index }>{ segment.text }</React.Fragment>) }
          </div>) }
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
        <svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='10.5' cy='10.5' r='6.5' /><path d='m15.5 15.5 4.5 4.5' /></svg>
        <input ref={ node => { this.input = node } } type='search' className='embedded-search-input' role='combobox'
          aria-label={ t('search.placeholder') } aria-autocomplete='list' aria-expanded={ Boolean(query) }
          aria-controls='embedded-search-results' aria-activedescendant={ query && results.length ? `embedded-result-${selected}` : undefined }
          placeholder={ t('menu.search') } value={ this.state.query }
          onChange={ event => this.setState({ query: event.target.value, selectedIndex: 0 }) }
          onKeyDown={ event => this.handleSearchKeyDown(event) } />
      </div>
      { query
        ? <div className='embedded-search-count' role='status' aria-live='polite'>
          { results.length === 1 ? t('search.resultCountOne') : t('search.resultCountMany', { count: results.length }) }
        </div>
        : null }
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
  scrollRequestStatus: state.scrollRequestStatus
})
const mapDispatch = dispatch => bindActionCreators({ selectGist, fetchSingleGist, updatescrollRequestStatus, updateGistFilters }, dispatch)
export default connect(mapState, mapDispatch)(EmbeddedSearch)
