import React from 'react'
import CodeMirror from 'codemirror'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import OriginalSnippet from '../../../app/containers/snippet/index'
import CodeArea from '../../../app/containers/codeArea'
import GistEditor from '../../../app/containers/gistEditor'
import Panel from '../../../app/containers/compatPanel'
import { editorActions, activateFormButton, lockEditorNavigation } from './editorToolbar'
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
    this.state = { revision: 0 }
    this.mounted = false
  }

  componentDidMount () {
    super.componentDidMount()
    this.mounted = true
    this.unsubscribeInlineSubmit = electronBridge.ipc.on('submit-gist', () => {
      if (!document.querySelector('.inline-new-editor') && currentDrafts().has(this.props.activeGist)) this.submitInline()
    })
  }

  componentDidUpdate (previousProps) {
    if (previousProps.gistEditModalStatus !== this.props.gistEditModalStatus) {
      const open = this.props.gistEditModalStatus === 'ON'
      lockEditorNavigation(open)
      if (open) this.formPanel?.querySelector('.gist-editor-input-area')?.focus()
    }
  }

  componentWillUnmount () {
    if (this.props.gistEditModalStatus === 'ON') lockEditorNavigation(false)
    this.mounted = false
    if (this.unsubscribeInlineSubmit) this.unsubscribeInlineSubmit()
    super.componentWillUnmount()
  }

  repaint () { if (this.mounted) this.setState(state => ({ revision: state.revision + 1 })) }

  showGistEditorModal () {
    const snippet = this.props.gists[this.props.activeGist]
    const files = filesFor(snippet)
    if (!files.length || typeof snippet.details.description !== 'string' || !files.every(isCodeFile)) {
      this.fullEditorDraft = null
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
    if (currentDrafts().get(this.props.activeGist)?.saving) return
    if (currentDrafts().delete(this.props.activeGist)) { this.repaint(); return }
    this.fullEditorDraft = null
    super.closeGistEditorModal()
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
        <Panel.Body>{ this.renderGistEditorModalBody(snippet.brief.description, files, !snippet.brief.public) }</Panel.Body>
      </Panel>
    </div>
  }

  renderInlineCode (node, draft) {
    if (Array.isArray(node)) return node.map(child => this.renderInlineCode(child, draft))
    if (!React.isValidElement(node)) return node
    if (node.type === CodeArea && isCodeFile(node.props)) {
      const filename = node.props.filename
      return <div key={ node.key } className='inline-code-editor' data-inline-filename={ filename }>
        <InlineGistEditor ref={ editor => editor?.editor?.getCodeMirror()?.getInputField()?.setAttribute('aria-label', filename) }
          filename={ filename } value={ draft ? draft.contents[filename] : node.props.content }
          readOnly={ !draft || draft.saving } onChange={ value => this.changeInline(filename, value) } />
      </div>
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
    return draft ? React.cloneElement(rendered, { className: rendered.props.className + ' inline-editing' }) : rendered
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
