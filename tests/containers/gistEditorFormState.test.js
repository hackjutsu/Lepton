import { describe, expect, it } from 'vitest'

import {
  copyValues,
  createFormState,
  getGistFileEditorKey,
  getInitialValues,
  getInitialValuesKey,
  getSubmitValues,
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
        { filename: '', content: '', _editorId: expect.any(String) }
      ]
    })
  })

  it('normalizes caller initial data into editable form state', () => {
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
        { filename: 'notes.md', content: '# Notes', _editorId: expect.any(String) },
        { filename: 'empty.js', content: '', _editorId: expect.any(String) }
      ]
    })
  })

  it('keeps a surviving file editor key stable when an earlier file is removed', () => {
    const values = getInitialValues({
      gists: [
        { filename: 'first.js', content: 'const first = true' },
        { filename: 'second.js', content: 'const second = true' }
      ]
    })
    const originalKeys = values.gistFiles.map((file, index) => getGistFileEditorKey(file, index))

    values.gistFiles.splice(0, 1)

    expect(getGistFileEditorKey(values.gistFiles[0], 0)).toBe(originalKeys[1])
    expect(getGistFileEditorKey(values.gistFiles[0], 0)).not.toBe(originalKeys[0])
  })

  it('tracks the normalized initial values key inside form state', () => {
    const initialData = {
      description: 'snippet',
      private: false,
      gists: [
        { filename: 'app.js', content: 'console.log(1)' }
      ]
    }

    const formState = createFormState(initialData)

    expect(getSubmitValues(formState.values)).toEqual(getSubmitValues(getInitialValues(initialData)))
    expect(formState).toMatchObject({
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
        { filename: 'app.js', content: 'console.log(1)', _editorId: 'editor-id' }
      ]
    }

    const copied = copyValues(values)
    copied.gistFiles[0].content = 'changed'

    expect(values.gistFiles[0].content).toBe('console.log(1)')
    expect(copied.gistFiles[0]._editorId).toBe(values.gistFiles[0]._editorId)
  })

  it('strips internal editor ids from submitted values', () => {
    expect(getSubmitValues({
      description: 'snippet',
      private: false,
      gistFiles: [
        { filename: 'app.js', content: 'console.log(1)', _editorId: 'editor-id' }
      ]
    })).toEqual({
      description: 'snippet',
      private: false,
      gistFiles: [
        { filename: 'app.js', content: 'console.log(1)' }
      ]
    })
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
