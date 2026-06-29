export function subscribeIpc (ipcRenderer, subscriptions, channel, listener) {
  const unsubscribe = ipcRenderer.on(channel, listener)
  if (typeof unsubscribe === 'function') {
    subscriptions.push(unsubscribe)
  }
}

export function unsubscribeIpc (subscriptions) {
  if (!subscriptions) return

  subscriptions.forEach(unsubscribe => {
    if (typeof unsubscribe === 'function') {
      unsubscribe()
    }
  })
  subscriptions.length = 0
}
