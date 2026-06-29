import { readFileSync } from 'fs'
import { describe, expect, it, vi } from 'vitest'

import {
  subscribeIpc,
  unsubscribeIpc
} from '../../app/utilities/ipcSubscriptions'

function createFakeIpc () {
  const listeners = {}

  return {
    on: vi.fn((channel, listener) => {
      listeners[channel] = listeners[channel] || []
      listeners[channel].push(listener)

      return () => {
        listeners[channel] = listeners[channel].filter(candidate => candidate !== listener)
      }
    }),
    emit: (channel, ...args) => {
      const channelListeners = listeners[channel] || []
      channelListeners.forEach(listener => listener(...args))
    },
    listenerCount: channel => (listeners[channel] || []).length
  }
}

function readRepoFile (path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

describe('IPC subscription lifecycle helpers', () => {
  it('removes only the listeners owned by one component', () => {
    const ipc = createFakeIpc()
    const firstSubscriptions = []
    const secondSubscriptions = []
    const firstListener = vi.fn()
    const secondListener = vi.fn()

    subscribeIpc(ipc, firstSubscriptions, 'exit-editor', firstListener)
    subscribeIpc(ipc, secondSubscriptions, 'exit-editor', secondListener)

    expect(ipc.listenerCount('exit-editor')).toBe(2)

    unsubscribeIpc(firstSubscriptions)
    ipc.emit('exit-editor')

    expect(ipc.listenerCount('exit-editor')).toBe(1)
    expect(firstListener).not.toHaveBeenCalled()
    expect(secondListener).toHaveBeenCalledTimes(1)
    expect(firstSubscriptions).toEqual([])
  })

  it('keeps renderer components off broad listener removal', () => {
    const rendererComponents = [
      'app/containers/snippet/index.js',
      'app/containers/userPanel/index.js',
      'app/containers/gistEditorForm/index.js',
      'app/containers/loginPage/index.js'
    ]

    rendererComponents.forEach(path => {
      expect(readRepoFile(path)).not.toContain('removeAllListeners')
    })

    expect(readRepoFile('app/containers/snippet/index.js')).toContain("'delete-gist'")
    expect(readRepoFile('main.js')).toContain("ipcMain.once('login-page-ready'")
  })
})
