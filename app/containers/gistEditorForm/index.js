import electronBridge from '../../utilities/electronBridge'
import { Button, ListGroup, ListGroupItem } from 'react-bootstrap'
import GistEditor from '../gistEditor'
import ImageFileView from '../imageFileView'
import Panel from '../compatPanel'
import React, { Component } from 'react'
import {
  copyValues,
  createFormState,
  appendImageAttachments,
  getGistFileEditorKey,
  getInitialValuesKey,
  getSubmitValues,
  hasValidationErrors,
  normalizeGistFile,
  shouldShowError,
  touchAllFields
} from './formState'
import { subscribeIpc, unsubscribeIpc } from '../../utilities/ipcSubscriptions'
import { t } from '../../utilities/i18n'
import { getSnippetProvider } from '../../utilities/snippetApi'
import { isValidSnippetFilePath } from '../../utilities/snippetFilePath'

import tipsIcon from './ei-question.svg'

import './index.scss'

const { normalizeImageMaxSizeKB } = require('../../utilities/config/preferences')
const {
  getFilesFromTransfer,
  getRenderableImageSource,
  isNativeBinaryImage
} = require('../../utilities/imageAttachments')

const { createFileAttachment } = require('../../utilities/fileImports')

export const NEW_GIST = 'NEW_GIST'
export const UPDATE_GIST = 'UPDATE_GIST'

const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

const DESCRIPTION_TIPS_ID = 'gist-editor-description-tips'
const getDescriptionTips = () => t('editor.descriptionPlaceholder')

function preventDefault (event) {
  event.preventDefault()
}

class GistEditorForm extends Component {
  constructor (props) {
    super(props)
    this.state = createFormState(props.initialData)
    this.handleSubmit = this.handleSubmit.bind(this)
    this.shortcutSubmit = this.shortcutSubmit.bind(this)
    this.handleDescriptionChange = this.handleDescriptionChange.bind(this)
    this.handlePrivateChange = this.handlePrivateChange.bind(this)
    this.addFile = this.addFile.bind(this)
    this.addFiles = this.addFiles.bind(this)
    this.handleFileDrop = this.handleFileDrop.bind(this)
    this.handleFilePickerChange = this.handleFilePickerChange.bind(this)
  }

  componentDidMount () {
    this.isMountedFlag = true
    this.ipcSubscriptions = []
    subscribeIpc(ipcRenderer, this.ipcSubscriptions, 'submit-gist', () => {
      this.shortcutSubmit()
    })
  }

  componentDidUpdate () {
    const nextInitialValuesKey = getInitialValuesKey(this.props.initialData)

    if (nextInitialValuesKey !== this.state.initialValuesKey) {
      this.setState(Object.assign(createFormState(this.props.initialData), {
        fileError: '',
        fileProcessing: false
      }))
    }
  }

  componentWillUnmount () {
    this.isMountedFlag = false
    unsubscribeIpc(this.ipcSubscriptions)
  }

  shortcutSubmit () {
    this.handleSubmit()
  }

  validateValues (values) {
    return {
      description: valideNotEmptyContent(values.description),
      gistFiles: values.gistFiles.map(file => ({
        filename: file._nativeBinary ? null : validateFilename(file.filename, getSnippetProvider().type),
        content: file._nativeBinary ? null : valideNotEmptyContent(file.content)
      }))
    }
  }

  updateValues (updater) {
    this.setState(state => {
      const values = updater(copyValues(state.values))
      return {
        values,
        errors: this.validateValues(values)
      }
    })
  }

  touchField (fieldName) {
    this.setState(state => ({
      touched: Object.assign({}, state.touched, {
        [fieldName]: true
      }),
      errors: this.validateValues(state.values)
    }))
  }

  handleDescriptionChange (event) {
    const value = event.target.value
    this.updateValues(values => Object.assign(values, { description: value }))
  }

  handlePrivateChange (event) {
    const value = event.target.checked
    this.updateValues(values => Object.assign(values, { private: value }))
  }

  handleFileChange (index, fieldName, value) {
    this.updateValues(values => {
      values.gistFiles[index] = Object.assign({}, values.gistFiles[index], {
        [fieldName]: value
      })
      return values
    })
  }

  addFile (event) {
    preventDefault(event)
    this.setState(state => {
      const values = copyValues(state.values)
      if (!values.gistFiles.some(file => !file.filename && !file.content)) {
        values.gistFiles.push(normalizeGistFile())
      }
      return { values, errors: this.validateValues(values) }
    }, () => {
      const index = this.state.values.gistFiles.findIndex(file => !file.filename && !file.content)
      const field = this.formNode.querySelectorAll('.gist-editor-filename-area')[index]
      if (field) {
        field.scrollIntoView({ block: 'center' })
        field.focus()
      }
    })
  }

  getImageAttachmentSettings () {
    const configuredMaxSizeKB = conf.get('editor:imageMaxSizeKB')
    const maxSizeKB = normalizeImageMaxSizeKB(configuredMaxSizeKB)
    if (configuredMaxSizeKB !== maxSizeKB) {
      const invalidValueKey = `${typeof configuredMaxSizeKB}:${String(configuredMaxSizeKB)}`
      if (this.lastInvalidImageMaxSizeKey !== invalidValueKey) {
        logger.warn(`[Image Attachments] Invalid editor:imageMaxSizeKB value; using ${maxSizeKB} KB`)
        this.lastInvalidImageMaxSizeKey = invalidValueKey
      }
    } else {
      this.lastInvalidImageMaxSizeKey = null
    }
    return { maxSizeKB }
  }

  formatFileError (error) {
    const details = error && error.details ? error.details : {}
    if (error && error.code === 'too-large') {
      return t('editor.imageTooLarge', {
        filename: details.filename,
        max: details.maxSizeKB,
        size: details.sizeKB
      })
    }
    if (error && error.code === 'unsupported-file') {
      return t('editor.fileUnsupported', { filename: details.filename })
    }
    if (error && error.code === 'read-failed') {
      return t('editor.fileReadFailed', { filename: details.filename })
    }
    return t('editor.imageUnsupported', { filename: details.filename || t('editor.imageFallbackName') })
  }

  addFiles (fileList) {
    const files = Array.from(fileList || [])
    const { maxSizeKB } = this.getImageAttachmentSettings()
    if (!files.length || this.fileProcessing) return Promise.resolve([])

    this.fileProcessing = true
    this.setState({ fileError: '', fileProcessing: true })
    const pending = files.map(file => {
      return createFileAttachment(file, maxSizeKB)
        .then(attachment => ({ attachment }))
        .catch(error => ({ error }))
    })

    return Promise.all(pending)
      .then(results => {
        if (!this.isMountedFlag) return []
        const attachments = results.filter(result => result.attachment).map(result => result.attachment)
        const firstError = results.find(result => result.error)

        return new Promise(resolve => {
          let filenames = []
          this.setState(state => {
            const values = copyValues(state.values)
            if (attachments.length) {
              const appended = appendImageAttachments(values.gistFiles, attachments)
              values.gistFiles = appended.gistFiles
              filenames = appended.filenames.filter((filename, index) => attachments[index]._imageAttachment)
            }
            return {
              values,
              errors: this.validateValues(values),
              fileError: firstError ? this.formatFileError(firstError.error) : ''
            }
          }, () => resolve(filenames))
        })
      })
      .finally(() => {
        this.fileProcessing = false
        if (this.isMountedFlag) this.setState({ fileProcessing: false })
      })
  }

  handleFileDrop (event) {
    preventDefault(event)
    event.stopPropagation()
    return this.addFiles(getFilesFromTransfer(event.dataTransfer, false))
  }

  handleFilePickerChange (event) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    return this.addFiles(files)
  }

  removeFile (event, index) {
    preventDefault(event)
    this.updateValues(values => {
      if (values.gistFiles.length > 1) {
        values.gistFiles.splice(index, 1)
      }
      return values
    })
  }

  handleSubmit (event) {
    if (event) preventDefault(event)
    if (this.state.fileProcessing) return

    const errors = this.validateValues(this.state.values)
    if (hasValidationErrors(errors)) {
      this.setState(state => ({
        errors,
        submitAttempted: true,
        touched: Object.assign({}, state.touched, touchAllFields(state.values))
      }))
      return
    }

    this.setState({
      errors,
      submitAttempted: true,
      submitting: true
    })

    const submittedValues = getSubmitValues(this.state.values)

    return Promise.resolve()
      .then(() => this.props.onSubmit(submittedValues))
      .finally(() => {
        if (this.isMountedFlag) {
          this.setState({ submitting: false })
        }
      })
  }

  render () {
    const { footerHelper, handleCancel, formStyle } = this.props
    const { values, errors, touched, submitAttempted, submitting, fileError, fileProcessing } = this.state
    const imageSettings = this.getImageAttachmentSettings()

    return (
      <form ref={ node => { this.formNode = node } } className='gist-editor-form' onSubmit={ this.handleSubmit }>
        { renderDescriptionField({
          value: values.description,
          type: 'text',
          error: errors.description,
          touched: shouldShowError(touched, submitAttempted, 'description'),
          onChange: this.handleDescriptionChange,
          onBlur: () => this.touchField('description')
        }) }
        { renderGistFiles({
          files: values.gistFiles,
          errors: errors.gistFiles || [],
          formStyle,
          touched,
          submitAttempted,
          privateValue: values.private,
          onAddFile: this.addFile,
          onRemoveFile: this.removeFile.bind(this),
          onFileChange: this.handleFileChange.bind(this),
          onFieldBlur: this.touchField.bind(this),
          onPrivateChange: this.handlePrivateChange,
          fileError,
          imageMaxSizeKB: imageSettings.maxSizeKB,
          fileProcessing,
          onFileDrop: this.handleFileDrop,
          onImageFiles: this.addFiles,
          onFilePickerChange: this.handleFilePickerChange
        }) }
        <hr/>
        <div className='control-button-group'>
          { footerHelper && (
            <div className='gist-editor-footer-helper'>
              <span aria-hidden='true'>ⓘ</span>
              <span>{ footerHelper }</span>
            </div>
          ) }
          <Button
            className='gist-editor-control-button'
            onClick={ handleCancel }
            bsStyle='default'
            disabled={ submitting || fileProcessing }>
            { t('editor.cancel') }
          </Button>
          <Button
            className='gist-editor-control-button'
            type='submit'
            bsStyle='default'
            disabled={ submitting || fileProcessing }>
            { t('editor.submit') }
          </Button>
        </div>
      </form>
    )
  }
}

const valideNotEmptyContent = value => value ? null : t('editor.required')

const validateFilename = (value, providerType) => {
  // empty filename is not allowed
  if (!value) {
    return t('editor.required')
  }

  // validate filename according to the .leptonrc configs
  if (!conf.get('editor').validateFilename) {
    logger.info('[Filename Validation] According to the config, filename validation has been skipped')
  } else if (!isValidSnippetFilePath(value, providerType)) {
    return t('editor.invalidFilename')
  }
}

const renderTitleInputField = ({ value, placeholder, type, touched, error, warning, disabled, onChange, onBlur }) => (
  <div className='title-input-field'>
    <input
      className='gist-editor-filename-area'
      value={ value }
      placeholder={ placeholder }
      type={ type }
      disabled={ disabled }
      onChange={ onChange }
      onBlur={ onBlur }/>
    { touched && ((error && <span className='error-msg'>{ error }</span>) ||
      (warning && <span className='error-msg'>{ warning }</span>)) }
  </div>
)

const renderDescriptionField = ({ value, type, touched, error, warning, onChange, onBlur }) => {
  const descriptionTips = getDescriptionTips()
  const tipsLabel = t('editor.tips')

  return (
    <div className='gist-editor-section gist-editor-name'>
      <input
        className='gist-editor-input-area'
        value={ value }
        type={ type }
        placeholder={ descriptionTips }
        onChange={ onChange }
        onBlur={ onBlur }/>
      { touched && ((error && <span className='error-msg'>{ error }</span>) ||
          (warning && <span className='error-msg'>{ warning }</span>)) }
      <button
        className='tips'
        type='button'
        aria-label={ `${tipsLabel}: ${descriptionTips}` }
        aria-describedby={ DESCRIPTION_TIPS_ID }>
        <span
          className='tips-icon'
          dangerouslySetInnerHTML={{ __html: tipsIcon }} />
        <span className='tips-label'>{ tipsLabel }</span>
        <span
          className='tips-popover'
          id={ DESCRIPTION_TIPS_ID }
          role='tooltip'>
          { descriptionTips }
        </span>
      </button>
    </div>
  )
}

const renderContentField = ({ file, type, touched, error, warning, onChange, onImageFiles }) => (
  <div>
    { getRenderableImageSource(file) || isNativeBinaryImage(file)
      ? <ImageFileView
        filename={ file.filename }
        content={ file.content }
        encoding={ file.encoding }
        rawUrl={ file.raw_url }
        size={ file.size }
        truncated={ file.truncated } />
      : <GistEditor
        filename={ file.filename }
        value={ file.content }
        onChange={ onChange }
        onImageFiles={ file._nativeBinary ? null : onImageFiles }
        readOnly={ file._nativeBinary }
        type={ type }/> }
    { touched && ((error && <span className='error-msg'>{error}</span>) ||
      (warning && <span className='error-msg'>{warning}</span>)) }
  </div>
)

function renderGistFileHeader ({
  file,
  index,
  fileCount,
  fileErrors,
  touched,
  submitAttempted,
  onRemoveFile,
  onFileChange,
  onFieldBlur
}) {
  const fieldName = `gistFiles.${index}.filename`

  return (
    <div>
      { renderTitleInputField({
        value: file.filename,
        type: 'text',
        disabled: file._nativeBinary,
        placeholder: t('editor.filenamePlaceholder'),
        error: fileErrors.filename,
        touched: shouldShowError(touched, submitAttempted, fieldName),
        onChange: event => onFileChange(index, 'filename', event.target.value),
        onBlur: () => onFieldBlur(fieldName)
      }) }
      <a href='#'
        className={ fileCount === 1 ? 'gist-editor-customized-tag-hidden' : 'gist-editor-customized-tag' }
        onClick={ event => onRemoveFile(event, index) }>{ t('editor.removeFile') }</a>
    </div>
  )
}

const renderGistFiles = ({
  files,
  errors,
  formStyle,
  touched,
  submitAttempted,
  privateValue,
  onAddFile,
  onRemoveFile,
  onFileChange,
  onFieldBlur,
  onPrivateChange,
  fileError,
  imageMaxSizeKB,
  fileProcessing,
  onFileDrop,
  onImageFiles,
  onFilePickerChange
}) => (
  <ListGroup className='gist-editor-section'>
    { files.map((file, index) => {
      const fileErrors = errors[index] || {}
      const contentFieldName = `gistFiles.${index}.content`

      return (
        <ListGroupItem className='gist-editor-gist-file' key={ getGistFileEditorKey(file, index) }>
          <Panel>
            <Panel.Heading>{ renderGistFileHeader({
              file,
              index,
              fileCount: files.length,
              fileErrors,
              touched,
              submitAttempted,
              onRemoveFile,
              onFileChange,
              onFieldBlur
            }) }</Panel.Heading>
            <Panel.Body>
              { renderContentField({
                file,
                type: 'text',
                error: fileErrors.content,
                touched: shouldShowError(touched, submitAttempted, contentFieldName),
                onChange: value => {
                  onFileChange(index, 'content', value)
                  onFieldBlur(contentFieldName)
                },
                onImageFiles
              }) }
            </Panel.Body>
          </Panel>
        </ListGroupItem>
      )
    }) }
    <div
      className={ `image-attachment-drop-zone${fileProcessing ? ' is-processing' : ''}` }
      onDragOver={ preventDefault }
      onDrop={ onFileDrop }
      aria-busy={ fileProcessing }>
      <span className='image-attachment-drop-title'>
        { fileProcessing ? t('editor.fileProcessing') : t('editor.fileDropLabel') }
      </span>
      <span className='image-attachment-drop-hint'>
        { t('editor.fileDropHint', { size: imageMaxSizeKB }) }
      </span>
      <div className='file-import-actions'>
        <label className='file-picker-button btn btn-default'>
          <input
            type='file'
            aria-label={ t('editor.chooseFiles') }
            multiple
            disabled={ fileProcessing }
            onChange={ onFilePickerChange } />
          { t('editor.chooseFiles') }
        </label>
        <Button type='button' onClick={ onAddFile } disabled={ fileProcessing }>
          { t('editor.createFile') }
        </Button>
      </div>
    </div>
    { fileError ? <div className='image-attachment-error' role='alert'>{ fileError }</div> : null }
    <div>
      <label className='gist-editor-privacy-checkbox'>
        <input
          className='gist-editor-privacy-input'
          name='private'
          id='private'
          type='checkbox'
          checked={ privateValue }
          onChange={ onPrivateChange }
          disabled={ formStyle === UPDATE_GIST }/>
        <span>{ t('editor.secret') }</span>
      </label>
    </div>

  </ListGroup>
)

export default GistEditorForm
