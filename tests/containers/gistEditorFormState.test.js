import { describe, expect, it } from 'vitest'

import {
  copyValues,
  createFormState,
  getInitialValues,
  getInitialValuesKey,
  hasValidationErrors,
  shouldShowError,
  touchAllFields
} from '../../app/containers/gistEditorForm/formState'

describe('gist editor form state helpers', () => {
  it('normalizes missing initial data to a single empty gist file', () => {
    expect(getInitialValues()).toEqual({
      description: '',
      private: false,
      gistFiles: [
        { filename: '', content: '' }
      ]
    })
  })

  it('normalizes caller initial data into the submit shape', () => {
    expect(getInitialValues({
      description: 'release notes',
      private: true,
      gists: [
        { filename: 'notes.md', content: '# Notes' },
        { filename: 'empty.js' }
      ]
    })).toEqual({
      description: 'release notes',
      private: true,
      gistFiles: [
        { filename: 'notes.md', content: '# Notes' },
        { filename: 'empty.js', content: '' }
      ]
    })
  })

  it('tracks the normalized initial values key inside form state', () => {
    const initialData = {
      description: 'snippet',
      private: false,
      gists: [
        { filename: 'app.js', content: 'console.log(1)' }
      ]
    }

    expect(createFormState(initialData)).toMatchObject({
      values: getInitialValues(initialData),
      errors: {},
      touched: {},
      submitAttempted: false,
      submitting: false,
      initialValuesKey: getInitialValuesKey(initialData)
    })
  })

  it('copies values before submit so nested gist files are not shared', () => {
    const values = {
      description: 'snippet',
      private: false,
      gistFiles: [
        { filename: 'app.js', content: 'console.log(1)' }
      ]
    }

    const copied = copyValues(values)
    copied.gistFiles[0].content = 'changed'

    expect(values.gistFiles[0].content).toBe('console.log(1)')
  })

  it('marks all editable fields touched after a failed submit', () => {
    expect(touchAllFields({
      description: '',
      private: false,
      gistFiles: [
        { filename: '', content: '' },
        { filename: '', content: '' }
      ]
    })).toEqual({
      description: true,
      'gistFiles.0.filename': true,
      'gistFiles.0.content': true,
      'gistFiles.1.filename': true,
      'gistFiles.1.content': true
    })
  })

  it('detects nested validation errors and gates error visibility', () => {
    expect(hasValidationErrors({
      description: null,
      gistFiles: [
        { filename: null, content: null }
      ]
    })).toBe(false)

    expect(hasValidationErrors({
      description: null,
      gistFiles: [
        { filename: 'Required', content: null }
      ]
    })).toBe(true)

    expect(shouldShowError({}, false, 'description')).toBe(false)
    expect(shouldShowError({ description: true }, false, 'description')).toBe(true)
    expect(shouldShowError({}, true, 'description')).toBe(true)
  })
})
