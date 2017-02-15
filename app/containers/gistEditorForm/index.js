import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Field, FieldArray, reduxForm, formValueSelector } from 'redux-form'
import { Button, ListGroup, ListGroupItem, Panel } from 'react-bootstrap'
import CodeMirror from 'react-codemirror'
import { modeInfo } from './meta'
import 'codemirror/mode/xml/xml'
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/clike/clike'
import 'codemirror/mode/javascript/javascript'
// TODO: list all mode here ?

import './index.scss'

export const NEW_GIST = 'NEW_GIST'
export const UPDATE_GIST = 'UPDATE_GIST'

class GistEditorForm extends Component {
  componentWillMount () {
    const { change, initialData } = this.props
    // Initialize the form
    initialData.private && change('private', initialData.private)
    initialData.description && change('description', initialData.description)
    initialData.gists && change('gistFiles', initialData.gists)
  }

  render () {
    const { handleSubmit, submitting, formStyle, modes } = this.props

    return (
      <form className='gist-editor-form' onSubmit={ handleSubmit }>
        <Field
          name='description'
          type='text'
          component={ renderDescriptionField }
          validate={ required }/>
        <FieldArray
          name='gistFiles'
          formStyle={ formStyle }
          modes={ modes }
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
        </div>
      </form>
    )
  }
}

const required = value => value ? undefined : 'required'

const renderTitleInputField = ({ input, placeholder, type, meta: { touched, error, warning } }) => (
  <div className='title-input-field'>
    <input className='gist-editor-filename-area' {...input} placeholder={ placeholder } type={ type }/>
    { touched && ((error && <span className='error-msg'>{ error }</span>) ||
      (warning && <span className='error-msg'>{ warning }</span>)) }
  </div>
)

const renderDescriptionField = ({ input, type, meta: { touched, error, warning } }) => (
  <div className='gist-editor-section'>
    <input
      className='gist-editor-input-area'
      { ...input }
      type={ type }
      placeholder='[title] gist description #tags: tag1, tag2'/>
      { touched && ((error && <span className='error-msg'>{ error }</span>) ||
        (warning && <span className='error-msg'>{ warning }</span>)) }
  </div>
)

const renderContentField = ({ input, type, placeholder, meta: { touched, error, warning }, mode }) => (
  <div>
    <CodeMirror
      options={{ mode: mode, lineNumbers: 'true', lineWrapping: 'true', viewportMargin: Infinity }}
      { ...input }
      type={ type }
      placeholder={ placeholder } />
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
        validate={ required }/>
      <a href='#'
        className={ index === 0 ? 'gist-editor-customized-tag-hidden' : 'gist-editor-customized-tag' }
        onClick={ () => fields.remove(index) }>#remove</a>
    </div>
  )
}

const renderGistFiles = ({ fields, formStyle, modes }) => (
  <ListGroup className='gist-editor-section'>
    { fields.map((member, index) =>
      <ListGroupItem className='gist-editor-gist-file' key={index}>
        <Panel header={ renderGistFileHeader(member, fields, index) }>
          <Field name={ `${member}.content` }
            type='text'
            mode={ modes && modes[index] }
            component={ renderContentField }
            validate={ required }/>
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

function findModeByFileName(filename) {
  for (let i = 0; i < modeInfo.length; i++) {
    const info = modeInfo[i];
    if (info.file && info.file.test(filename)) return info.mode;
  }
  const dot = filename.lastIndexOf(".");
  const ext = dot > -1 && filename.substring(dot + 1, filename.length);
  if (ext) {
    for (let i = 0; i < modeInfo.length; i++) {
      const info = modeInfo[i];
      if (info.ext) for (let j = 0; j < info.ext.length; j++)
        if (info.ext[j] == ext) return info.mode;
    }
  }
  return 'plaintext'
}

const selector = formValueSelector('gistEditorForm')
GistEditorForm = connect(
  state => {
    const gistFiles = selector(state, 'gistFiles')
    const modes = gistFiles && gistFiles.map(({filename}) =>
      filename && findModeByFileName(filename))
    return {
      modes
    }
  }
)(GistEditorForm)

export default reduxForm({
  form: 'gistEditorForm'
})(GistEditorForm)