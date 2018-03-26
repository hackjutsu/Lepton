'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Field, FieldArray, reduxForm, formValueSelector } from 'redux-form'
import { OverlayTrigger, Tooltip, Button, ListGroup, ListGroupItem, Panel } from 'react-bootstrap'
import GistEditor from '../gistEditor'
import validFilename from 'valid-filename'
import { ipcRenderer } from 'electron'

import tipsIcon from './ei-question.svg'

import './index.scss'

export const NEW_GIST = 'NEW_GIST'
export const UPDATE_GIST = 'UPDATE_GIST'

const descriptionTips = '[title] description #tag1 #tag2'

const tooltip = (
  <Tooltip id='tooltip'>{ descriptionTips }</Tooltip>
)

class GistEditorFormImpl extends Component {
  componentWillMount () {
    const { change, initialData } = this.props
    // Initialize the form
    initialData.private && change('private', initialData.private)
    initialData.description && change('description', initialData.description)
    initialData.gists && change('gistFiles', initialData.gists)
  }

  componentDidMount () {
    ipcRenderer.on('submit-gist', () => {
      this.shortcutSubmit()
    })
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('submit-gist')
  }

  shortcutSubmit () {
    // https://github.com/erikras/redux-form/issues/1304
    const submitter = this.props.handleSubmit(this.props.onSubmit)
    submitter() // submits
  }

  render () {
    const { handleSubmit, handleCancel, submitting, formStyle, filenameList } = this.props

    return (
      <form className='gist-editor-form' onSubmit={ handleSubmit }>
        <Field
          name='description'
          type='text'
          component={ renderDescriptionField }
          validate={ valideNotEmptyContent }/>
        <FieldArray
          name='gistFiles'
          formStyle={ formStyle }
          filenameList={ filenameList }
          component={ renderGistFiles }/>
        <hr/>
        <div className='control-button-group'>
          <Button
            className='gist-editor-control-button'
            type='submit'
            bsStyle='success'
            disabled={ submitting }>
            Submit
          </Button>
          <Button
            className='gist-editor-control-button'
            onClick={ handleCancel }
            bsStyle='default'
            disabled={ submitting }>
              Cancel
          </Button>
        </div>
      </form>
    )
  }
}

const valideNotEmptyContent = value => value ? null : 'required'

const validateFilename = value => {
  if (!value) return 'required'
  else if (!validFilename(value)) return 'invalid filename'
}

const renderTitleInputField = ({ input, placeholder, type, meta: { touched, error, warning } }) => (
  <div className='title-input-field'>
    <input className='gist-editor-filename-area' {...input} placeholder={ placeholder } type={ type }/>
    { touched && ((error && <span className='error-msg'>{ error }</span>) ||
      (warning && <span className='error-msg'>{ warning }</span>)) }
  </div>
)

const renderDescriptionField = ({ input, type, meta: { touched, error, warning } }) => (
  <div className='gist-editor-section gist-editor-name'>
    <input
      className='gist-editor-input-area'
      { ...input }
      type={ type }
      placeholder={ descriptionTips }/>
    { touched && ((error && <span className='error-msg'>{ error }</span>) ||
        (warning && <span className='error-msg'>{ warning }</span>)) }
    <OverlayTrigger placement="top" overlay={ tooltip }>
      <a className='tips' href='#'>
        <div
          className='tips-icon'
          dangerouslySetInnerHTML={{ __html: tipsIcon }} />
        <span>tips</span>
      </a>
    </OverlayTrigger>
  </div>
)

const renderContentField = ({ input, type, meta: { touched, error, warning }, filename }) => (
  <div>
    <GistEditor
      filename={ filename }
      { ...input }
      type={ type }/>
    { touched && ((error && <span className='error-msg'>{error}</span>) ||
      (warning && <span className='error-msg'>{warning}</span>)) }
  </div>
)

function renderGistFileHeader (member, fields, index) {
  return (
    <div>
      <Field
        name={ `${member}.filename` }
        type='text'
        component={ renderTitleInputField }
        placeholder='file name... (e.g. snippet.js)'
        validate={ validateFilename }/>
      <a href='#'
        className={ fields.length === 1 ? 'gist-editor-customized-tag-hidden' : 'gist-editor-customized-tag' }
        onClick={ () => fields.remove(index) }>#remove</a>
    </div>
  )
}

const renderGistFiles = ({ fields, formStyle, filenameList }) => (
  <ListGroup className='gist-editor-section'>
    { fields.map((member, index) =>
      <ListGroupItem className='gist-editor-gist-file' key={index}>
        <Panel>
          <Panel.Heading>{ renderGistFileHeader(member, fields, index) }</Panel.Heading>
          <Panel.Body>
            <Field name={ `${member}.content` }
              type='text'
              filename={ filenameList && filenameList[index] }
              component={ renderContentField }
              validate={ valideNotEmptyContent }/>
          </Panel.Body>
        </Panel>
      </ListGroupItem>
    ) }
    <div>
      <a href='#'
        className='gist-editor-customized-tag'
        onClick={ () => fields.push({}) }>
        #add file
      </a>
      <div className='gist-editor-privacy-checkbox'>
        <Field name='private' id='private' component='input' type='checkbox' disabled={ formStyle === UPDATE_GIST }/>
         &nbsp;private
      </div>
    </div>
  </ListGroup>
)

const selector = formValueSelector('gistEditorForm')
const GistEditorForm = connect(
  state => {
    const gistFiles = selector(state, 'gistFiles')
    const filenameList = gistFiles && gistFiles.map(({filename}) =>
      filename)
    return {
      filenameList
    }
  }
)(GistEditorFormImpl)

export default reduxForm({
  form: 'gistEditorForm'
})(GistEditorForm)
