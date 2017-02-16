import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Field, FieldArray, reduxForm, formValueSelector } from 'redux-form'
import { Button, ListGroup, ListGroupItem, Panel } from 'react-bootstrap'
import GistEditor from '../gistEditor'

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
    const { handleSubmit, submitting, formStyle, filenameList } = this.props

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

const renderContentField = ({ input, type, meta: { touched, error, warning }, filename }) => (
  <div>
    <GistEditor
      options={{ lineNumbers: 'true', lineWrapping: 'true', viewportMargin: Infinity, placeholder: '// Code' }}
      filename={ filename }
      { ...input }
      type={ type } />
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

const renderGistFiles = ({ fields, formStyle, filenameList }) => (
  <ListGroup className='gist-editor-section'>
    { fields.map((member, index) =>
      <ListGroupItem className='gist-editor-gist-file' key={index}>
        <Panel header={ renderGistFileHeader(member, fields, index) }>
          <Field name={ `${member}.content` }
            type='text'
            filename={ filenameList && filenameList[index] }
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

const selector = formValueSelector('gistEditorForm')
GistEditorForm = connect(
  state => {
    const gistFiles = selector(state, 'gistFiles')
    const filenameList = gistFiles && gistFiles.map(({filename}) =>
      filename)
    return {
      filenameList
    }
  }
)(GistEditorForm)

export default reduxForm({
  form: 'gistEditorForm'
})(GistEditorForm)