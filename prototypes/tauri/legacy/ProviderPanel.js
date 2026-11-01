import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function ProviderPanel ({ mode, connect, disconnect }) {
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState('gitlab')
  const [base, setBase] = useState('https://gitlab.com')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit (event) {
    event.preventDefault()
    setBusy(true); setError('')
    try { await connect(provider, base.trim(), token); setToken(''); setOpen(false) } catch (err) { setError(String(err)) } finally { setBusy(false) }
  }
  async function oauth () {
    setBusy(true); setError('')
    try { const credential = await invoke('start_github_oauth'); await connect('github', 'https://github.com', credential); setOpen(false) } catch (err) { setError(String(err)) } finally { setBusy(false) }
  }
  async function switchLocal () {
    setBusy(true); setError('')
    try { await disconnect(); setOpen(false) } catch (err) { setError(String(err)); setOpen(true) } finally { setBusy(false) }
  }
  return <div className='local-provider-panel'>
    {mode === 'local' ? <button onClick={() => setOpen(true)}>Connect account</button> : <button disabled={busy} onClick={switchLocal}>Switch to local library</button>}
    {open && <div className='local-provider-overlay' role='dialog' aria-modal='true' aria-labelledby='provider-title'>
      <form onSubmit={submit}>
        <h2 id='provider-title'>Connect account</h2>
        <p>Your token stays in memory for this session. The local library remains separate.</p>
        <label>Provider<select value={provider} onChange={event => { const selected = event.target.value; setProvider(selected); setBase(selected === 'github' ? 'https://github.com' : 'https://gitlab.com') }}><option value='gitlab'>GitLab</option><option value='github'>GitHub</option></select></label>
        <label>Provider URL<input value={base} onChange={event => setBase(event.target.value)} required autoComplete='url' /></label>
        {provider === 'github' && base === 'https://github.com' && <button type='button' disabled={busy} onClick={oauth}>Sign in with GitHub OAuth</button>}
        <label>Personal access token<input value={token} onChange={event => setToken(event.target.value)} type='password' required autoComplete='off' /></label>
        {error && <p className='provider-error' role='alert'>{error}</p>}
        <div><button type='button' disabled={busy} onClick={() => { setToken(''); setOpen(false) }}>Cancel</button><button type='submit' disabled={busy}>{busy ? 'Connecting…' : 'Connect'}</button></div>
      </form>
    </div>}
  </div>
}
