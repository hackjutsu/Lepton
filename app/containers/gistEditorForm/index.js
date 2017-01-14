import React from 'react'
import { Field, FieldArray, reduxForm } from 'redux-form'
import { Button, ListGroup, ListGroupItem, Panel } from 'react-bootstrap'

import './index.scss'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

const renderDescriptionField = ({ input, type }) => (
  <div className='gist-editor-section'>
    <input className='gist-editor-input-area' { ...input } type={ type } placeholder='Gist description...'/>
  </div>
)

const renderContentField = ({ input, type, placeholder }) => (
  <div>
    <textarea className='gist-editor-content-area' { ...input } type={ type } placeholder={ placeholder }/>
  </div>
)

function renderGistFileHeader (member, fields, index) {
  return (
      <div>
        <Field className='gist-editor-filename-area'
          name={ `${member}.filename` }
          type='text'
          component='input'
          placeholder='File name...'/>
        <a href='#'
          className='gist-editor-customized-tag'
          onClick={ () => fields.remove(index) }>#remove</a>
      </div>
  )
}

const renderGistFiles = ({ fields, meta: { touched, error } }) => (
  <ListGroup className='gist-editor-section'>
    {fields.map((member, index) =>
      <ListGroupItem className='gist-editor-gist-file' key={index}>
        <Panel header={ renderGistFileHeader(member, fields, index) }>
          <Field name={ `${member}.content` }
            type='text'
            component={ renderContentField }/>
        </Panel>
      </ListGroupItem>
    )}
    <div>
      <a href='#'
        className='gist-editor-customized-tag'
        onClick={() => fields.push({})}>
        #add file
      </a>
    </div>
  </ListGroup>
)

const gistEditorForm = (props) => {
  const { handleSubmit, submitting } = props
  return (
    <form onSubmit={ handleSubmit }>
      <Field name='description' type='text' component={ renderDescriptionField }/>
      <FieldArray name='gistFiles' component={ renderGistFiles }/>
      <hr/>
        <div className='control-button-group'>
          <Button
            className='gist-editor-control-button'
            type='submit'
            bsStyle="danger"
            disabled={ submitting }>
            Create secret gist
          </Button>
          <Button
            className='gist-editor-control-button'
            type='submit'
            bsStyle='success'
            disabled={ submitting }>
            Create public gist
          </Button>
        </div>
    </form>
  )
}

export default reduxForm({
  form: 'gistEditorForm'
})(gistEditorForm)
