import electronBridge from '../electronBridge'

const rendererStore = electronBridge.store

class Store {
  constructor (opts) {
    this.configName = opts.configName
    this.data = rendererStore.get(this.configName, opts.defaults)
  }

  // This will just return the property on the `data` object
  get (key) {
    return this.data[key]
  }

  // ...and this will set it
  set (key, val) {
    this.data[key] = val
    rendererStore.set(this.configName, this.data)
  }
}

export default Store
