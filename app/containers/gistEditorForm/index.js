import electronBridge from '../../utilities/electronBridge'
import { Button, ListGroup, ListGroupItem, Panel } from 'react-bootstrap'
import GistEditor from '../gistEditor'
import React, { Component } from 'react'
import {
  copyValues,
  createFormState,
  getInitialValuesKey,
  hasValidationErrors,
  normalizeGistFile,
  shouldShowError,
  touchAllFields
} from './formState'
import { t } from '../../utilities/i18n'
import validFilename from 'valid-filename'

import tipsIcon from './ei-question.svg'

import './index.scss'

export const NEW_GIST = 'NEW_GIST'
export const UPDATE_GIST = 'UPDATE_GIST'

const conf = electronBridge.config
const ipcRenderer = electronBridge.ipc
const logger = electronBridge.logger

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
  }

  componentDidMount () {
    this.isMountedFlag = true
    ipcRenderer.on('submit-gist', () => {
      this.shortcutSubmit()
    })
  }

  componentDidUpdate () {
    const nextInitialValuesKey = getInitialValuesKey(this.props.initialData)

    if (nextInitialValuesKey !== this.state.initialValuesKey) {
      this.setState(createFormState(this.props.initialData))
    }
  }

  componentWillUnmount () {
    this.isMountedFlag = false
    ipcRenderer.removeAllListeners('submit-gist')
  }

  shortcutSubmit () {
    this.handleSubmit()
  }

  validateValues (values) {
    return {
      description: valideNotEmptyContent(values.description),
      gistFiles: values.gistFiles.map(file => ({
        filename: validateFilename(file.filename),
        content: valideNotEmptyContent(file.content)
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
    this.updateValues(values => {
      values.gistFiles.push(normalizeGistFile())
      return values
    })
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

    const submittedValues = copyValues(this.state.values)

    return Promise.resolve()
      .then(() => this.props.onSubmit(submittedValues))
      .finally(() => {
        if (this.isMountedFlag) {
          this.setState({ submitting: false })
        }
      })
  }

  render () {
    const { handleCancel, formStyle } = this.props
    const { values, errors, touched, submitAttempted, submitting } = this.state

    return (
      <form className='gist-editor-form' onSubmit={ this.handleSubmit }>
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
          onPrivateChange: this.handlePrivateChange
        }) }
        <hr/>
        <div className='control-button-group'>
          <Button
            className='gist-editor-control-button'
            type='submit'
            bsStyle='default'
            disabled={ submitting }>
            { t('editor.submit') }
          </Button>
          <Button
            className='gist-editor-control-button'
            onClick={ handleCancel }
            bsStyle='default'
            disabled={ submitting }>
            { t('editor.cancel') }
          </Button>
        </div>
      </form>
    )
  }
}

const valideNotEmptyContent = value => value ? null : t('editor.required')

const validateFilename = value => {
  // empty filename is not allowed
  if (!value) {
    return t('editor.required')
  }

  // validate filename according to the .leptonrc configs
  if (!conf.get('editor').validateFilename) {
    logger.info('[Filename Validation] According to the config, filename validation has been skipped')
  } else if (!validFilename(value)) {
    return t('editor.invalidFilename')
  }
}

const renderTitleInputField = ({ value, placeholder, type, touched, error, warning, onChange, onBlur }) => (
  <div className='title-input-field'>
    <input
      className='gist-editor-filename-area'
      value={ value }
      placeholder={ placeholder }
      type={ type }
      onChange={ onChange }
      onBlur={ onBlur }/>
    { touched && ((error && <span className='error-msg'>{ error }</span>) ||
      (warning && <span className='error-msg'>{ warning }</span>)) }
  </div>
)

const renderDescriptionField = ({ value, type, touched, error, warning, onChange, onBlur }) => (
  <div className='gist-editor-section gist-editor-name'>
    <input
      className='gist-editor-input-area'
      value={ value }
      type={ type }
      placeholder={ getDescriptionTips() }
      onChange={ onChange }
      onBlur={ onBlur }/>
    { touched && ((error && <span className='error-msg'>{ error }</span>) ||
        (warning && <span className='error-msg'>{ warning }</span>)) }
    <a
      className='tips'
      href='#'
      title={ getDescriptionTips() }
      onClick={ event => event.preventDefault() }>
      <div
        className='tips-icon'
        dangerouslySetInnerHTML={{ __html: tipsIcon }} />
      <span>{ t('editor.tips') }</span>
    </a>
  </div>
)

const renderContentField = ({ value, type, touched, error, warning, filename, onChange }) => (
  <div>
    <GistEditor
      filename={ filename }
      value={ value }
      onChange={ onChange }
      type={ type }/>
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
  onPrivateChange
}) => (
  <ListGroup className='gist-editor-section'>
    { files.map((file, index) => {
      const fileErrors = errors[index] || {}
      const contentFieldName = `gistFiles.${index}.content`

      return (
        <ListGroupItem className='gist-editor-gist-file' key={index}>
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
                value: file.content,
                type: 'text',
                filename: file.filename,
                error: fileErrors.content,
                touched: shouldShowError(touched, submitAttempted, contentFieldName),
                onChange: value => {
                  onFileChange(index, 'content', value)
                  onFieldBlur(contentFieldName)
                }
              }) }
            </Panel.Body>
          </Panel>
        </ListGroupItem>
      )
    }) }
    <div>
      <a href='#'
        className='gist-editor-customized-tag'
        onClick={ onAddFile }>
        { t('editor.addFile') }
      </a>
      <div className='gist-editor-privacy-checkbox'>
        <input
          name='private'
          id='private'
          type='checkbox'
          checked={ privateValue }
          onChange={ onPrivateChange }
          disabled={ formStyle === UPDATE_GIST }/>
         &nbsp;{ t('editor.secret') }
      </div>
    </div>
  </ListGroup>
)

export default GistEditorForm
