import React from 'react'
import { t } from '../../../app/utilities/i18n'

export function editorActions (cancel, submit, disabled = false) {
  return [
    <button key='cancel' type='button' className='snippet-control inline-toolbar-action' title={ t('editor.cancel') } aria-label={ t('editor.cancel') } disabled={ disabled } onClick={ cancel }>
      <svg viewBox='0 0 50 50' aria-hidden='true'><path d='M15 13.6 25 23.6 35 13.6 36.4 15 26.4 25 36.4 35 35 36.4 25 26.4 15 36.4 13.6 35 23.6 25 13.6 15z' /></svg>
    </button>,
    <button key='submit' type='button' className='snippet-control inline-toolbar-action' title={ t('editor.submit') } aria-label={ t('editor.submit') } disabled={ disabled } onClick={ submit }>
      <svg viewBox='0 0 50 50' aria-hidden='true'><path d='m12 25 1.5-1.5 8.1 8.1L36.5 16.7l1.5 1.5-16.4 16.4z' /></svg>
    </button>
  ]
}

// The form owns validation, in-flight saves and import processing. Clicking its
// own buttons preserves those guards and the existing keyboard behavior.
export function activateFormButton (container, submit) {
  const selector = submit ? '.gist-editor-control-button[type="submit"]' : '.gist-editor-control-button:not([type="submit"])'
  container?.querySelector(selector)?.click()
}

// The original modal prevented navigation during a full form edit. Preserve
// that guard so switching snippets cannot silently replace an unsaved form.
export function lockEditorNavigation (locked) {
  document.querySelectorAll('.menu-panel, .panel-thumbnails-background').forEach(node => { node.inert = locked })
}
