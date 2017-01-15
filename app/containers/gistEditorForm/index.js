import React, { Component } from 'react'
import { Field, FieldArray, reduxForm } from 'redux-form'
import { Button, ListGroup, ListGroupItem, Panel, Checkbox } from 'react-bootstrap'

import './index.scss'

import { remote } from 'electron'
const logger = remote.getGlobal('logger')

export const NEW_GIST = 'NEW_GIST'
export const UPDATE_GIST = 'UPDATE_GIST'

class GistEditorForm extends Component {
  componentWillMount() {
    const { change, initialData } = this.props
    logger.debug('props.initialData is ' + JSON.stringify(initialData))

    // Initialize the form
    initialData.private && change('private', initialData.private)
    initialData.description && change('description', initialData.description)
    initialData.gists && change('gistFiles', initialData.gists)
  }

  render() {
    logger.debug('Inside gistEditorForm render method')
    const { handleSubmit, submitting, formStyle } = this.props

    return (
      <form onSubmit={ handleSubmit }>
        <Field
          name='description'
          type='text'
          component={ renderDescriptionField }/>
        <FieldArray
          name='gistFiles'
          formStyle={ formStyle }
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

const renderDescriptionField = ({ input, type }) => (
  <div className='gist-editor-section'>
    <input
      className='gist-editor-input-area'
      { ...input }
      type={ type }
      placeholder='Gist description...'/>
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

const renderGistFiles = ({ fields, formStyle }) => (
  <ListGroup className='gist-editor-section'>
    { fields.map((member, index) =>
      <ListGroupItem className='gist-editor-gist-file' key={index}>
        <Panel header={ renderGistFileHeader(member, fields, index) }>
          <Field name={ `${member}.content` }
            type='text'
            component={ renderContentField }/>
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

export default reduxForm({
  form: 'gistEditorForm'
})(GistEditorForm)
