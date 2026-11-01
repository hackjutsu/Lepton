import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import Editor from './Editor'
import './style.css'

const emptyDraft = () => ({
  id: null,
  title: '',
  filename: 'untitled.rs',
  tags: [],
  content: ''
})

function App() {
  const [snippets, setSnippets] = useState([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null)
  const [original, setOriginal] = useState(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const [status, setStatus] = useState('Opening local library…')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(original)
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const initialized = useRef(false)

  function select(snippet) {
    setDraft(snippet)
    setOriginal(snippet)
    setEditorVersion((value) => value + 1)
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    const timer = setTimeout(() => {
      invoke('search_snippets', { query })
        .then((results) => {
          if (!active) return
          setSnippets(results)
          if (!initialized.current) {
            initialized.current = true
            if (results.length) select(results[0])
            setStatus('Local library ready')
          }
          setError('')
        })
        .catch((err) => {
          if (active) setError(String(err))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 120)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, revision])

  useEffect(() => {
    let disposed = false
    let unlisten
    getCurrentWindow()
      .onCloseRequested((event) => {
        if (dirtyRef.current) {
          event.preventDefault()
          setStatus('Save or discard your changes before closing.')
        }
      })
      .then((stop) => {
        if (disposed) stop()
        else unlisten = stop
      })
      .catch((err) => setError(String(err)))
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  async function save() {
    if (saving || !draft) return
    setSaving(true)
    setError('')
    try {
      const saved = await invoke('save_snippet', { draft })
      // Keep editor focus and undo history when saving.
      setDraft(saved)
      setOriginal(saved)
      setRevision((value) => value + 1)
      setStatus('Saved on this computer')
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark">L</span> lepton
          <span className="prototype">LAB</span>
        </div>
        <div className="rail-heading">WORKSPACE</div>
        <div className="workspace">
          <span>▤</span> Local library <span className="dot" />
        </div>
        <p className="rail-note">
          Your useful little things,
          <br />
          always within reach.
        </p>
        <div className="rail-bottom">
          <span className="runtime-dot" /> Rust + Tauri{' '}
          <small>Local prototype · 0.1</small>
        </div>
      </aside>
      <section className="library" aria-label="Snippet library">
        <div className="library-top">
          <div>
            <span className="eyebrow">YOUR COLLECTION</span>
            <h1>Snippets</h1>
          </div>
          <button
            className="add"
            aria-label="New snippet"
            title="New snippet"
            disabled={dirty || saving || !initialized.current}
            onClick={() => {
              setDraft(emptyDraft())
              setOriginal(null)
              setEditorVersion((value) => value + 1)
              setStatus('New local snippet')
            }}
          >
            +
          </button>
        </div>
        <label className="search">
          <span>⌕</span>
          <input
            aria-label="Search snippets"
            placeholder="Search your library…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="list-meta">
          {loading ? 'Searching…' : `${snippets.length} snippets`}
          <span>LOCAL</span>
        </div>
        <div className="snippet-list">
          {snippets.map((snippet) => (
            <button
              className={`snippet ${draft?.id === snippet.id ? 'selected' : ''}`}
              key={snippet.id}
              disabled={dirty || saving}
              onClick={() => select(snippet)}
            >
              <span className="filetype">
                {snippet.filename.split('.').pop().toUpperCase()}
              </span>
              <strong>{snippet.title}</strong>
              <span className="filename">{snippet.filename}</span>
              <span className="tags">
                {snippet.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </span>
            </button>
          ))}
          {!loading && !snippets.length ? (
            <p className="empty">
              No matching snippets.
              <br />
              Try a complete word from the code or its tags.
            </p>
          ) : null}
        </div>
        <div className="library-foot">Exact words · titles, tags & code</div>
      </section>
      <main>
        <header className="toolbar">
          <span>
            <span className="local-dot" /> Local workspace{' '}
            <span className="separator">/</span>{' '}
            {draft?.filename || 'No selection'}
          </span>
          <span className="badge">PROTOTYPE</span>
        </header>
        {draft ? (
          <>
            <section className="document-heading">
              <span className="eyebrow">SNIPPET DETAILS</span>
              <input
                className="title-input"
                aria-label="Snippet title"
                placeholder="Give this snippet a title"
                value={draft.title}
                disabled={saving}
                onChange={(event) => update('title', event.target.value)}
              />
              <div className="fields">
                <label>
                  Filename
                  <input
                    value={draft.filename}
                    disabled={saving}
                    onChange={(event) => update('filename', event.target.value)}
                  />
                </label>
                <label>
                  Tags <span>(comma separated)</span>
                  <input
                    value={draft.tags.join(',')}
                    disabled={saving}
                    onChange={(event) =>
                      update('tags', event.target.value.split(','))
                    }
                  />
                </label>
              </div>
            </section>
            <div className="code-header">
              <span>〈 / 〉 &nbsp; {draft.filename || 'untitled'}</span>
              <span>{draft.content.split('\n').length} lines</span>
            </div>
            <fieldset
              className="editor-fieldset"
              disabled={saving}
              inert={saving ? true : undefined}
            >
              <Editor
                key={editorVersion}
                initialContent={draft.content}
                filename={draft.filename}
                onChange={(content) => update('content', content)}
              />
            </fieldset>
            <footer>
              <span role="status">{dirty ? '● Unsaved changes' : status}</span>
              <div>
                <button
                  disabled={!dirty || saving}
                  onClick={() => {
                    select(original)
                    setStatus('Changes discarded')
                  }}
                >
                  Discard
                </button>
                <button
                  className="save"
                  disabled={
                    !dirty ||
                    saving ||
                    !draft.title.trim() ||
                    !draft.filename.trim()
                  }
                  onClick={save}
                >
                  {saving ? 'Saving…' : 'Save snippet'}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="empty">Choose a snippet or create something new.</div>
        )}
        {dirty ? (
          <div className="dirty-hint">
            Save or discard changes before switching snippets or closing.
          </div>
        ) : null}
        {error ? (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setRevision((value) => value + 1)}>
              Retry loading
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
