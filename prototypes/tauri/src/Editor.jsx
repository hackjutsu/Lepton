import React, { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'

function languageFor(filename) {
  if (filename.endsWith('.rs')) return rust()
  if (filename.endsWith('.py')) return python()
  if (/\.[jt]sx?$/.test(filename))
    return javascript({ typescript: /\.tsx?$/.test(filename), jsx: true })
  return []
}

export default function Editor({ initialContent, filename, onChange }) {
  const host = useRef(null)
  const editor = useRef(null)
  const language = useRef(new Compartment())
  const initial = useRef(initialContent)
  const change = useRef(onChange)
  change.current = onChange
  // The parent remounts the editor only when loading/discarding a document.
  useEffect(() => {
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          basicSetup,
          language.current.of([]),
          EditorView.contentAttributes.of({ 'aria-label': 'Snippet code' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) change.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': {
              overflow: 'auto',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              lineHeight: '1.8'
            },
            '.cm-content': { padding: '24px 0' },
            '.cm-gutters': {
              backgroundColor: '#fafbf9',
              color: '#a1aaa3',
              border: 'none',
              paddingRight: '12px'
            },
            '.cm-activeLine, .cm-activeLineGutter': {
              backgroundColor: '#f1f5ee'
            },
            '&.cm-focused': { outline: 'none' }
          })
        ]
      })
    })
    editor.current = view
    return () => {
      editor.current = null
      view.destroy()
    }
  }, [])
  useEffect(() => {
    editor.current?.dispatch({
      effects: language.current.reconfigure(languageFor(filename))
    })
  }, [filename])
  return <div className="editor" ref={host} />
}
