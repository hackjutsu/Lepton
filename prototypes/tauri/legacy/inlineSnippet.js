import React from 'react'
import CodeMirror from 'codemirror'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import OriginalSnippet from '../../../app/containers/snippet/index'
import CodeArea from '../../../app/containers/codeArea'
import GistEditor from '../../../app/containers/gistEditor'
import Panel from '../../../app/containers/compatPanel'
import DiscardConfirmation, { hasUnsavedForm } from './discardConfirmation'
import { getInitialValuesKey } from '../../../app/containers/gistEditorForm/formState'
import { editorActions, activateFormButton, lockEditorNavigation } from './editorToolbar'
import { currentSearchQuery, subscribeSearchQuery, subscribeSearchSelection, searchRanges, highlightRenderedText, matchingSearchResults } from './searchHighlights'
import electronBridge from '../../../app/utilities/electronBridge'
import { getLocale, t } from '../../../app/utilities/i18n'
import { EDIT_SINGLE_GIST, getSnippetApi } from '../../../app/utilities/snippetApi'
import { getSessionGeneration, isSessionGenerationCurrent } from '../../../app/utilities/sessionGeneration'
import { isImageAttachmentFile, isNativeBinaryImage } from '../../../app/utilities/imageAttachments'
import { updateSingleGist, updateGistTags, updateGistFilters, updateGistEditModeStatus, updateGistDeleteModeStatus, updateGistRawModal, updateFileExpandStatus } from '../../../app/actions'

const BaseSnippet = OriginalSnippet.WrappedComponent
const drafts = new Map()
let draftGeneration = getSessionGeneration()
const messages = {
  en: { details: 'Edit details…', discard: 'Discard in-place changes and open the full editor?', conflict: 'This snippet changed while you were editing. Copy your changes, then cancel and reopen the editor.' },
  es: { details: 'Editar detalles…', discard: '¿Descartar los cambios y abrir el editor completo?', conflict: 'El fragmento cambió durante la edición. Copia tus cambios, cancela y vuelve a abrir el editor.' },
  fr: { details: 'Modifier les détails…', discard: 'Abandonner les modifications et ouvrir l’éditeur complet ?', conflict: 'L’extrait a changé pendant la modification. Copiez vos changements, annulez et rouvrez l’éditeur.' },
  ja: { details: '詳細を編集…', discard: '変更を破棄して完全なエディターを開きますか？', conflict: '編集中にスニペットが変更されました。変更をコピーし、キャンセルしてからエディターを開き直してください。' },
  ko: { details: '상세 정보 편집…', discard: '변경 사항을 버리고 전체 편집기를 여시겠습니까?', conflict: '편집 중 스니펫이 변경되었습니다. 변경 사항을 복사한 후 취소하고 편집기를 다시 여세요.' },
  tr: { details: 'Ayrıntıları düzenle…', discard: 'Değişiklikler atılıp tam düzenleyici açılsın mı?', conflict: 'Düzenleme sırasında parçacık değişti. Değişikliklerinizi kopyalayın, iptal edin ve düzenleyiciyi yeniden açın.' },
  'zh-Hans': { details: '编辑详情…', discard: '放弃当前修改并打开完整编辑器？', conflict: '编辑期间代码片段已更改。请复制修改内容，然后取消并重新打开编辑器。' },
  'zh-Hant': { details: '編輯詳細資訊…', discard: '放棄目前的變更並開啟完整編輯器？', conflict: '編輯期間程式碼片段已變更。請複製修改內容，然後取消並重新開啟編輯器。' }
}
const inlineMessage = key => (messages[getLocale()] || messages.en)[key]
const emptySearchMessages = {
  en: { title: 'No snippets found', hint: 'Try a different search.', short: 'Type at least two characters to search.' },
  es: { title: 'No se encontraron fragmentos', hint: 'Prueba otra búsqueda.', short: 'Escribe al menos dos caracteres para buscar.' },
  fr: { title: 'Aucun extrait trouvé', hint: 'Essayez une autre recherche.', short: 'Saisissez au moins deux caractères pour rechercher.' },
  ja: { title: 'スニペットが見つかりません', hint: '別の言葉で検索してください。', short: '検索するには2文字以上入力してください。' },
  ko: { title: '스니펫을 찾을 수 없습니다', hint: '다른 검색어를 입력해 보세요.', short: '검색하려면 두 글자 이상 입력하세요.' },
  tr: { title: 'Kod parçası bulunamadı', hint: 'Başka bir arama deneyin.', short: 'Aramak için en az iki karakter yazın.' },
  'zh-Hans': { title: '没有找到代码片段', hint: '请尝试其他搜索词。', short: '请输入至少两个字符进行搜索。' },
  'zh-Hant': { title: '找不到程式碼片段', hint: '請嘗試其他搜尋詞。', short: '請輸入至少兩個字元進行搜尋。' }
}

function highlightText (text, query) {
  if (typeof text !== 'string') return text
  const output = []
  let offset = 0
  for (const [start, end] of searchRanges(text, query)) {
    if (start > offset) output.push(text.slice(offset, start))
    output.push(<mark className='detail-search-match' key={ start }>{ text.slice(start, end) }</mark>)
    offset = end
  }
  if (offset < text.length) output.push(text.slice(offset))
  return output.length ? output : text
}

function highlightTitle (node, query) {
  if (Array.isArray(node)) return node.map(child => highlightTitle(child, query))
  if (!React.isValidElement(node)) return node
  if (node.props.className === 'title-section') return React.cloneElement(node, null, highlightText(node.props.children, query))
  if (!node.props.children) return node
  return React.cloneElement(node, null, highlightTitle(node.props.children, query))
}

function currentDrafts () {
  const generation = getSessionGeneration()
  if (generation !== draftGeneration) { drafts.clear(); draftGeneration = generation }
  return drafts
}

// Only files with a recognized code mode are changed. Documents and images
// keep the existing renderer and the existing full snippet editor.
export function isCodeFile (file) {
  if (!file || typeof file.content !== 'string' || typeof file.filename !== 'string' || file.truncated) return false
  if (isImageAttachmentFile(file) || isNativeBinaryImage(file)) return false
  if (/\.(?:md|markdown|mdown|mkd|adoc|asciidoc|ipynb|rst|txt)$/i.test(file.filename)) return false
  if (/^(?:markdown|asciidoc|jupyter notebook|text|plain text)$/i.test(file.language || '')) return false
  const mode = CodeMirror.findModeByFileName(file.filename)
  return Boolean(mode && !/^(?:markdown|gfm|textile|rst|plain text)$/i.test(mode.name))
}

function filesFor (snippet) {
  if (!snippet?.details || snippet.details._leptonUnavailable || !snippet.details.files) return []
  return Object.entries(snippet.details.files).map(([filename, file]) => ({ ...file, filename }))
}

// Set the language before CodeMirror's first render. The shared editor normally
// sets it after mounting, which makes large previews render the document twice.
class InlineGistEditor extends GistEditor {
  componentDidMount () {
    super.componentDidMount()
    this.searchMarkers = []
    this.onSearchContentChanged = () => {
      if (this.searchFrame) cancelAnimationFrame(this.searchFrame)
      this.searchFrame = requestAnimationFrame(() => { this.searchFrame = null; this.updateSearchHighlights() })
    }
    this.editor.getCodeMirror().on('changes', this.onSearchContentChanged)
    this.updateSearchHighlights()
  }

  componentDidUpdate (previousProps, previousState) {
    super.componentDidUpdate(previousProps, previousState)
    if (previousProps.expanded !== this.props.expanded && this.props.expanded) this.editor.getCodeMirror().refresh()
    if (previousProps.searchQuery !== this.props.searchQuery || previousProps.value !== this.props.value || previousProps.expanded !== this.props.expanded) this.updateSearchHighlights()
  }

  componentWillUnmount () {
    if (this.searchFrame) cancelAnimationFrame(this.searchFrame)
    const editor = this.editor?.getCodeMirror()
    if (editor) editor.off('changes', this.onSearchContentChanged)
    for (const marker of this.searchMarkers || []) marker.clear()
    super.componentWillUnmount()
  }

  updateSearchHighlights () {
    const editor = this.editor?.getCodeMirror()
    if (!editor) return
    editor.operation(() => {
      for (const marker of this.searchMarkers) marker.clear()
      this.searchMarkers = searchRanges(editor.getValue(), this.props.searchQuery || '').map(([start, end]) =>
        editor.markText(editor.posFromIndex(start), editor.posFromIndex(end), { className: 'cm-detail-search-match' }))
    })
  }

  setMode (filename) {
    const mode = filename && CodeMirror.findModeByFileName(filename)
    if (!mode || this.editor.getCodeMirror().getOption('mode') !== mode.mime) super.setMode(filename)
  }

  render () {
    const editor = super.render()
    const mode = this.props.filename && CodeMirror.findModeByFileName(this.props.filename)
    return mode ? React.cloneElement(editor, { options: { ...editor.props.options, mode: mode.mime } }) : editor
  }
}

class InlineSnippet extends BaseSnippet {
  constructor (props) {
    super(props)
    this.state = { revision: 0, confirmDiscard: false, searchQuery: currentSearchQuery() }
    this.mounted = false
  }

  componentDidMount () {
    super.componentDidMount()
    this.mounted = true
    this.unsubscribeSearchQuery = subscribeSearchQuery(query => { if (this.mounted) this.setState({ searchQuery: query }) })
    this.unsubscribeSearchSelection = subscribeSearchSelection(id => { this.revealSearchId = id; this.scheduleSearchHighlights() })
    this.unsubscribeInlineSubmit = electronBridge.ipc.on('submit-gist', () => {
      if (!document.querySelector('.inline-new-editor') && currentDrafts().has(this.props.activeGist)) this.submitInline()
    })
    this.scheduleSearchHighlights()
  }

  componentDidUpdate (previousProps) {
    if (previousProps.gistEditModalStatus !== this.props.gistEditModalStatus) {
      const open = this.props.gistEditModalStatus === 'ON'
      lockEditorNavigation(open)
      if (open) this.formPanel?.querySelector('.gist-editor-input-area')?.focus()
    }
    this.scheduleSearchHighlights()
  }

  componentWillUnmount () {
    if (this.props.gistEditModalStatus === 'ON') lockEditorNavigation(false)
    this.mounted = false
    if (this.unsubscribeSearchQuery) this.unsubscribeSearchQuery()
    if (this.unsubscribeSearchSelection) this.unsubscribeSearchSelection()
    if (this.searchHighlightTimer) clearTimeout(this.searchHighlightTimer)
    if (this.unsubscribeInlineSubmit) this.unsubscribeInlineSubmit()
    super.componentWillUnmount()
  }

  repaint () { if (this.mounted) this.setState(state => ({ revision: state.revision + 1 })) }

  scheduleSearchHighlights () {
    if (this.searchHighlightTimer) clearTimeout(this.searchHighlightTimer)
    this.searchHighlightTimer = setTimeout(() => {
      this.searchHighlightTimer = null
      const root = this.snippetRoot
      if (!root) return
      for (const node of root.querySelectorAll('.description-section, .code-area')) highlightRenderedText(node, this.state.searchQuery)
      if (this.revealSearchId && this.revealSearchId === this.props.activeGist) {
        this.revealSearchId = null
        const marks = root.querySelectorAll('.collapsable-code-area .cm-detail-search-match, .collapsable-code-area .detail-search-match, .snippet-description .detail-search-match, .file-expand .detail-search-match')
        const first = [...marks].find(mark => mark.getClientRects().length > 0)
        first?.scrollIntoView({ block: 'center' })
      }
    }, 0)
  }

  renderSnippetDescription (gist) { return highlightTitle(super.renderSnippetDescription(gist), this.state.searchQuery) }

  showGistEditorModal () {
    const snippet = this.props.gists[this.props.activeGist]
    const files = filesFor(snippet)
    if (!files.length || typeof snippet.details.description !== 'string' || !files.every(isCodeFile)) {
      this.fullEditorDraft = null
      if (files.length && snippet?.details) this.fullEditorBaselineKey = getInitialValuesKey({ description: snippet.brief.description, gists: files, private: !snippet.brief.public })
      return super.showGistEditorModal()
    }
    if (currentDrafts().has(this.props.activeGist)) return
    const contents = Object.fromEntries(files.map(file => [file.filename, file.content]))
    currentDrafts().set(this.props.activeGist, {
      contents: { ...contents }, original: contents,
      description: snippet.details.description,
      updatedAt: snippet.details.updated_at
    })
    const expanded = { ...this.props.fileExpandStatus }
    for (const file of files) expanded[this.props.activeGist + '-' + file.filename] = true
    this.props.updateFileExpandStatus(expanded)
    this.setState(state => ({ revision: state.revision + 1 }), () => {
      document.querySelector('.snippet-box.inline-editing .inline-code-editor .CodeMirror')?.CodeMirror.focus()
    })
  }

  closeGistEditorModal () {
    if (document.querySelector('.inline-new-editor')) return
    const draft = currentDrafts().get(this.props.activeGist)
    if (draft?.saving || this.localEditSaving) return
    if (!this.closingAfterSave && ((draft && Object.keys(draft.original).some(name => draft.original[name] !== draft.contents[name])) || hasUnsavedForm(this.fullEditorForm, this.fullEditorBaselineKey))) {
      this.setState({ confirmDiscard: true })
      return
    }
    this.discardEditor()
  }

  discardEditor () {
    this.setState({ confirmDiscard: false })
    if (currentDrafts().delete(this.props.activeGist)) { this.repaint(); return }
    this.fullEditorDraft = null
    this.fullEditorBaselineKey = null
    super.closeGistEditorModal()
  }

  handleGistEditorFormSubmit (data) {
    this.closingAfterSave = true
    return Promise.resolve(super.handleGistEditorFormSubmit(data)).finally(() => { this.closingAfterSave = false })
  }

  changeInline (filename, value) {
    const draft = currentDrafts().get(this.props.activeGist)
    if (!draft || draft.saving) return
    draft.contents[filename] = value
  }

  openFullEditor () {
    const draft = currentDrafts().get(this.props.activeGist)
    if (draft?.saving) return
    this.fullEditorDraft = draft ? { id: this.props.activeGist, contents: { ...draft.contents } } : null
    const snippet = this.props.gists[this.props.activeGist]
    this.fullEditorBaselineKey = getInitialValuesKey({ description: snippet.brief.description, gists: filesFor(snippet), private: !snippet.brief.public })
    currentDrafts().delete(this.props.activeGist)
    this.repaint()
    super.showGistEditorModal()
  }

  async submitInline () {
    const id = this.props.activeGist
    const draft = currentDrafts().get(id)
    const snippet = this.props.gists[id]
    if (!draft || !snippet?.details || draft.saving) return
    const currentFiles = filesFor(snippet)
    if (snippet.details.updated_at !== draft.updatedAt || snippet.details.description !== draft.description ||
      currentFiles.length !== Object.keys(draft.original).length || currentFiles.some(file => draft.original[file.filename] !== file.content)) {
      await electronBridge.dialog.showMessage({ message: inlineMessage('conflict') })
      return
    }
    const patch = {}
    for (const [filename, content] of Object.entries(draft.contents)) {
      if (content !== draft.original[filename]) patch[filename] = { content }
    }
    if (!Object.keys(patch).length) { currentDrafts().delete(id); this.repaint(); return }
    const generation = getSessionGeneration()
    draft.saving = true
    this.repaint()
    try {
      const result = await getSnippetApi(EDIT_SINGLE_GIST)(this.props.accessToken, id, draft.description, patch)
      if (!isSessionGenerationCurrent(generation)) return
      currentDrafts().delete(id)
      if (this.mounted && this.props.activeGist === id && this.props.gists[id]) this.updateGistsStoreWithUpdatedGist(result)
      else if (this.mounted && this.props.gists[id]?.details && result?.files) {
        // The user may select another snippet while the save is in flight.
        // Update the saved snippet directly instead of relying on timestamps
        // when reloading the remote list.
        const previous = this.props.gists[id]
        const files = Object.fromEntries(Object.entries(result.files).map(([name, file]) => {
          const cached = previous.details.files[name]
          return [name, typeof file.content !== 'string' && typeof cached?.content === 'string' ? { ...cached, ...file } : file]
        }))
        const details = { ...previous.details, ...result, files }
        const saved = { ...previous, brief: details, details }
        this.props.updateSingleGist({ [id]: saved })
        this.props.searchIndex.updateFuseIndex(this.props.searchIndex.buildSearchRecord(saved))
      } else await this.props.reSyncUserGists()
    } catch (error) {
      if (isSessionGenerationCurrent(generation)) {
        electronBridge.logger.error('In-place snippet save failed', error)
        await electronBridge.dialog.showMessage({ message: `${t('notification.gistUpdateFailed')}\n${error.message || error}` })
      }
    } finally {
      draft.saving = false
      this.repaint()
    }
  }

  renderPanelHeader (snippet) {
    const original = super.renderPanelHeader(snippet)
    const draft = currentDrafts().get(this.props.activeGist)
    const fullEditor = this.props.gistEditModalStatus === 'ON'
    if (!draft && !fullEditor) return original
    const line = original.props.children
    const [title, controls] = React.Children.toArray(line.props.children)
    const originalControls = React.Children.toArray(controls.props.children).map(control => {
      if (draft && React.isValidElement(control) && control.props.title === t('snippet.edit')) {
        return React.cloneElement(control, { title: inlineMessage('details'), onClick: event => { event.preventDefault(); this.openFullEditor() } })
      }
      if (fullEditor && React.isValidElement(control)) {
        return React.cloneElement(control, { 'aria-disabled': 'true', tabIndex: -1, onClick: event => event.preventDefault() })
      }
      return control
    })
    const actions = React.cloneElement(controls, { className: 'header-controls inline-edit-actions' },
      ...editorActions(
        () => fullEditor ? activateFormButton(this.formPanel, false) : this.closeGistEditorModal(),
        () => fullEditor ? activateFormButton(this.formPanel, true) : this.submitInline(),
        Boolean(draft?.saving)),
      ...originalControls)
    return React.cloneElement(original, null, React.cloneElement(line, null, title, actions))
  }

  // The original modal form stays mounted in the detail pane, with its
  // existing file imports, validation and save handlers intact.
  renderGistEditorModal () { return null }

  renderFullEditor (snippet) {
    if (!snippet?.details || snippet.details._leptonUnavailable) return super.render()
    const contents = this.fullEditorDraft?.id === this.props.activeGist ? this.fullEditorDraft.contents : {}
    const files = Object.entries(snippet.details.files || {}).map(([filename, file]) => ({ filename, ...file, ...(Object.prototype.hasOwnProperty.call(contents, filename) ? { content: contents[filename] } : {}) }))
    const isInternal = snippet.brief.providerType === 'gitlab' && snippet.brief.visibility === 'internal'
    return <div className='snippet-box inline-form-edit' ref={ node => { this.formPanel = node } }>
      <Panel className='snippet-code' bsStyle={ isInternal ? 'warning' : snippet.brief.public ? 'default' : 'danger' }>
        <Panel.Heading>{ this.renderPanelHeader(snippet) }</Panel.Heading>
        <Panel.Body>{ React.cloneElement(this.renderGistEditorModalBody(snippet.brief.description, files, !snippet.brief.public), { ref: form => { this.fullEditorForm = form } }) }</Panel.Body>
      </Panel>
      <DiscardConfirmation show={ this.state.confirmDiscard } onKeepEditing={ () => this.setState({ confirmDiscard: false }) } onDiscard={ () => this.discardEditor() } />
    </div>
  }

  renderInlineCode (node, draft) {
    if (Array.isArray(node)) return node.map(child => this.renderInlineCode(child, draft))
    if (!React.isValidElement(node)) return node
    if (node.type === CodeArea && isCodeFile(node.props)) {
      const filename = node.props.filename
      const expandKey = this.props.activeGist + '-' + filename
      const expanded = this.props.fileExpandStatus[expandKey] === undefined
        ? Boolean(electronBridge.config.get('snippet:expanded'))
        : this.props.fileExpandStatus[expandKey]
      return <div key={ node.key } className='inline-code-editor' data-inline-filename={ filename }>
        <InlineGistEditor ref={ editor => editor?.editor?.getCodeMirror()?.getInputField()?.setAttribute('aria-label', filename) } searchQuery={ this.state.searchQuery } expanded={ expanded }
          filename={ filename } value={ draft ? draft.contents[filename] : node.props.content }
          readOnly={ !draft || draft.saving } onChange={ value => this.changeInline(filename, value) } />
      </div>
    }
    if (node.type === 'a' && typeof node.props.className === 'string' && node.props.className.split(' ').includes('file-expand')) {
      return React.cloneElement(node, null, React.Children.map(node.props.children, child => React.isValidElement(child)
        ? React.cloneElement(child, null, highlightText(child.props.children, this.state.searchQuery)) : child))
    }
    if (!node.props.children) return node
    return React.cloneElement(node, null, this.renderInlineCode(node.props.children, draft))
  }

  render () {
    if (this.props.gistEditModalStatus === 'ON') return this.renderFullEditor(this.props.gists[this.props.activeGist])
    const tree = super.render()
    if (!tree) return tree
    const draft = currentDrafts().get(this.props.activeGist)
    const rendered = this.renderInlineCode(tree, draft)
    const noResults = Boolean(this.state.searchQuery.trim()) && matchingSearchResults(this.state.searchQuery, this.props.gists).length === 0
    const content = React.cloneElement(rendered, {
      ref: node => { this.snippetRoot = node },
      className: rendered.props.className + (draft ? ' inline-editing' : ''),
      style: { ...rendered.props.style, visibility: noResults ? 'hidden' : undefined },
      'aria-hidden': noResults || undefined,
      inert: noResults || undefined
    })
    const emptyMessage = emptySearchMessages[getLocale()] || emptySearchMessages.en
    return <>{ noResults ? <div className='search-detail-empty' role='status'>
      <svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='10.5' cy='10.5' r='6.5' /><path d='m15.5 15.5 4.5 4.5' /></svg>
      <div className='search-detail-empty-title'>{ emptyMessage.title }</div>
      <p>{ this.state.searchQuery.trim().length < 2 ? emptyMessage.short : emptyMessage.hint }</p>
    </div> : null }{ content }<DiscardConfirmation show={ this.state.confirmDiscard } onKeepEditing={ () => this.setState({ confirmDiscard: false }) } onDiscard={ () => this.discardEditor() } /></>
  }
}

function mapState (state) {
  return {
    gists: state.gists, activeGistFilters: state.activeGistFilters, activeGist: state.activeGist,
    userSession: state.userSession, accessToken: state.accessToken, gistTags: state.gistTags,
    immersiveMode: state.immersiveMode, gistRawModal: state.gistRawModal,
    gistEditModalStatus: state.gistEditModalStatus, gistDeleteModalStatus: state.gistDeleteModalStatus,
    fileExpandStatus: state.fileExpandStatus
  }
}

const mapDispatch = dispatch => bindActionCreators({ updateSingleGist, updateGistTags, updateGistFilters, updateGistEditModeStatus, updateGistDeleteModeStatus, updateGistRawModal, updateFileExpandStatus }, dispatch)
export default connect(mapState, mapDispatch)(InlineSnippet)
