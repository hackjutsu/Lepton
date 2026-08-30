import React, { PureComponent } from 'react'
import electronBridge from '../../utilities/electronBridge'
import { t } from '../../utilities/i18n'

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
    this.lastSearchedQuery = ''
    this.query = ''
    this.restoreInputFocus = false
    this.unsubscribeFindRequest = null
    this.unsubscribeFindResult = null

    this.close = this.close.bind(this)
    this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this)
    this.handleInputKeyDown = this.handleInputKeyDown.bind(this)
    this.handleQueryChange = this.handleQueryChange.bind(this)
    this.handleResult = this.handleResult.bind(this)
    this.open = this.open.bind(this)
  }

  getBridge () {
    return this.props.bridge || electronBridge
  }

  componentDidMount () {
    const windowBridge = this.getBridge().window
    this.unsubscribeFindRequest = windowBridge.onFindInPageRequest(this.open)
    this.unsubscribeFindResult = windowBridge.onFindInPageResult(this.handleResult)
    document.addEventListener('keydown', this.handleGlobalKeyDown, true)
  }

  componentWillUnmount () {
    document.removeEventListener('keydown', this.handleGlobalKeyDown, true)
    this.cancelScheduledFind()
    if (this.unsubscribeFindRequest) this.unsubscribeFindRequest()
    if (this.unsubscribeFindResult) this.unsubscribeFindResult()
    if (this.state.isOpen) this.getBridge().window.stopFindInPage()
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
    this.restoreInputFocus = false
    this.getBridge().window.stopFindInPage()
    this.setState({
      activeMatchOrdinal: 0,
      isOpen: false,
      matches: 0
    })
  }

  runFind (query, startNewSession, forward = true) {
    if (!query) return
    this.lastSearchedQuery = query
    this.restoreInputFocus = document.activeElement === this.inputRef.current
    this.getBridge().window.findInPage(query, {
      // Electron uses findNext=true for a new session and false to continue it.
      findNext: startNewSession,
      forward
    })
  }

  scheduleFind (query) {
    this.cancelScheduledFind()
    this.findTimer = setTimeout(() => {
      this.findTimer = null
      const runFind = () => {
        this.findFrame = null
        if (!this.state.isOpen || this.query !== query) return
        this.runFind(query, true)
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
    this.focusInput()
    this.runFind(
      this.query,
      this.lastSearchedQuery !== this.query,
      forward
    )
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
      this.restoreInputFocus = false
      this.getBridge().window.stopFindInPage()
    }
  }

  handleResult (result) {
    if (!this.state.isOpen || !this.query || !result || result.finalUpdate === false) return
    if (result.query !== this.query) return

    const activeMatchOrdinal = result.activeMatchOrdinal || 0
    const matches = result.matches || 0
    const restoreInputFocus = this.restoreInputFocus
    this.restoreInputFocus = false
    if (this.state.activeMatchOrdinal === activeMatchOrdinal && this.state.matches === matches) {
      if (restoreInputFocus) this.focusInput()
      return
    }

    this.setState({ activeMatchOrdinal, matches }, () => {
      if (restoreInputFocus) this.focusInput()
    })
  }

  render () {
    if (!this.state.isOpen) return null

    const { activeMatchOrdinal, hasQuery, matches } = this.state
    const currentMatch = matches === 0 ? 0 : activeMatchOrdinal
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
        disabled: !hasQuery,
        onClick: () => this.navigate(false),
        title: t('findInPage.previous'),
        type: 'button'
      }, h('span', { 'aria-hidden': true }, '\u2039')),
      h('button', {
        'aria-label': t('findInPage.next'),
        className: 'find-in-page-button',
        disabled: !hasQuery,
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
