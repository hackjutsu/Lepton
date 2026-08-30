import React, { PureComponent } from 'react'
import electronBridge from '../../utilities/electronBridge'
import { t } from '../../utilities/i18n'
import { createPageFinder } from '../../utilities/pageFind'

import './index.scss'

const FIND_DEBOUNCE_MS = 100

export function isFindInPageAvailable (state) {
  const userSession = state.userSession || {}
  const gistRawModal = state.gistRawModal || {}
  const blockingStatuses = [
    state.aboutModalStatus,
    state.dashboardModalStatus,
    state.gistDeleteModalStatus,
    state.gistEditModalStatus,
    state.gistNewModalStatus,
    gistRawModal.status,
    state.logoutModalStatus,
    state.pinnedTagsModalStatus,
    state.searchWindowStatus
  ]

  return userSession.activeStatus === 'ACTIVE' &&
    blockingStatuses.every(status => status !== 'ON')
}

class FindInPage extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      activeMatchOrdinal: 0,
      hasQuery: false,
      isOpen: false,
      matches: 0
    }
    this.findFrame = null
    this.inputRef = React.createRef()
    this.findTimer = null
    this.finder = props.finder || createPageFinder()
    this.lastSearchedQuery = ''
    this.query = ''
    this.unsubscribeFindRequest = null

    this.close = this.close.bind(this)
    this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this)
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
    this.open = this.open.bind(this)
  }

  getBridge () {
    return this.props.bridge || electronBridge
  }

  componentDidMount () {
    const windowBridge = this.getBridge().window
    this.unsubscribeFindRequest = windowBridge.onFindInPageRequest(this.open)
    document.addEventListener('keydown', this.handleGlobalKeyDown, true)
  }

  componentWillUnmount () {
    document.removeEventListener('keydown', this.handleGlobalKeyDown, true)
    this.cancelScheduledFind()
    if (this.unsubscribeFindRequest) this.unsubscribeFindRequest()
    this.finder.clear()
  }

  cancelScheduledFind () {
    if (this.findTimer !== null) {
      clearTimeout(this.findTimer)
      this.findTimer = null
    }
    if (this.findFrame !== null && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this.findFrame)
      this.findFrame = null
    }
  }

  focusInput (selectQuery = false) {
    if (!this.inputRef.current) return
    this.inputRef.current.focus()
    if (selectQuery) this.inputRef.current.select()
  }

  open () {
    const wasOpen = this.state.isOpen
    this.setState({ isOpen: true }, () => {
      this.focusInput(true)
      if (!wasOpen && this.query) this.scheduleFind(this.query)
    })
  }

  close () {
    this.cancelScheduledFind()
    this.lastSearchedQuery = ''
    this.finder.clear()
    this.setState({
      activeMatchOrdinal: 0,
      isOpen: false,
      matches: 0
    })
  }

  runFind (query) {
    if (!query) return
    this.lastSearchedQuery = query
    this.updateResult(this.finder.search(query))
  }

  scheduleFind (query) {
    this.cancelScheduledFind()
    this.findTimer = setTimeout(() => {
      this.findTimer = null
      const runFind = () => {
        this.findFrame = null
        if (!this.state.isOpen || this.query !== query) return
        this.runFind(query)
      }

      if (typeof window.requestAnimationFrame === 'function') {
        this.findFrame = window.requestAnimationFrame(runFind)
      } else {
        runFind()
      }
    }, FIND_DEBOUNCE_MS)
  }

  navigate (forward) {
    if (!this.query) return
    this.cancelScheduledFind()
    const result = this.lastSearchedQuery === this.query
      ? this.finder.navigate(forward)
      : this.finder.search(this.query)
    this.lastSearchedQuery = this.query
    this.updateResult(result)
    this.focusInput()
  }

  handleGlobalKeyDown (event) {
    const isFindShortcut = (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      String(event.key).toLowerCase() === 'f'

    if (isFindShortcut) {
      event.preventDefault()
      event.stopPropagation()
      this.open()
      return
    }

    if (this.state.isOpen && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      this.close()
    }
  }

  handleInputKeyDown (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    this.navigate(!event.shiftKey)
  }

  handleQueryChange (event) {
    const query = event.target.value
    const hasQuery = Boolean(query)
    this.query = query
    this.cancelScheduledFind()
    this.lastSearchedQuery = ''
    this.finder.clear()
    if (this.state.activeMatchOrdinal !== 0 ||
        this.state.matches !== 0 ||
        this.state.hasQuery !== hasQuery) {
      this.setState({
        activeMatchOrdinal: 0,
        hasQuery,
        matches: 0
      })
    }

    if (query) {
      this.scheduleFind(query)
    } else {
      this.focusInput()
    }
  }

  updateResult (result) {
    if (!this.state.isOpen || !this.query || !result) return
    const activeMatchOrdinal = result.activeMatchOrdinal || 0
    const matches = result.matches || 0
    if (this.state.activeMatchOrdinal === activeMatchOrdinal && this.state.matches === matches) {
      return
    }
    this.setState({ activeMatchOrdinal, matches })
  }

  render () {
    if (!this.state.isOpen) return null

    const { activeMatchOrdinal, hasQuery, matches } = this.state
    const currentMatch = matches === 0 ? 0 : activeMatchOrdinal
    const canNavigate = matches > 1
    const h = React.createElement

    return h(
      'div',
      { className: 'find-in-page', role: 'search' },
      h('input', {
        'aria-label': t('findInPage.placeholder'),
        className: 'find-in-page-input',
        onInput: this.handleQueryChange,
        onKeyDown: this.handleInputKeyDown,
        placeholder: t('findInPage.placeholder'),
        ref: this.inputRef,
        spellCheck: false,
        type: 'search',
        defaultValue: this.query
      }),
      h('span', {
        'aria-live': 'polite',
        className: 'find-in-page-count'
      }, `${currentMatch}/${matches}`),
      h('button', {
        'aria-label': t('findInPage.previous'),
        className: 'find-in-page-button',
        disabled: !hasQuery || !canNavigate,
        onClick: () => this.navigate(false),
        title: t('findInPage.previous'),
        type: 'button'
      }, h('span', { 'aria-hidden': true }, '\u2039')),
      h('button', {
        'aria-label': t('findInPage.next'),
        className: 'find-in-page-button',
        disabled: !hasQuery || !canNavigate,
        onClick: () => this.navigate(true),
        title: t('findInPage.next'),
        type: 'button'
      }, h('span', { 'aria-hidden': true }, '\u203a')),
      h('button', {
        'aria-label': t('dialog.close'),
        className: 'find-in-page-button find-in-page-close',
        onClick: this.close,
        title: t('dialog.close'),
        type: 'button'
      }, h('span', { 'aria-hidden': true }, '\u00d7'))
    )
  }
}

export default FindInPage
