import { invoke } from '@tauri-apps/api/core'

// Read paths and preferences before importing the original components, which
// synchronously consult the bridge during module initialization.
invoke('runtime_info').then(info => {
  window.__leptonRuntimeInfo = info
  return import('./index')
}).catch(error => {
  document.getElementById('container').textContent = `Unable to load Lepton settings: ${String(error)}`
})
