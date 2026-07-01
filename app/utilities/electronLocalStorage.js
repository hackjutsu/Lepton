const fs = require('fs')
const path = require('path')

function createErrorObject (error) {
  return {
    status: false,
    error
  }
}

function createSuccessObject (data) {
  return {
    status: true,
    data
  }
}

function validateStorageKey (key) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('Invalid Key')
  }
}

function getStorageDir (userDataPath) {
  return path.join(userDataPath, 'storage')
}

function getStorageFilePath (userDataPath, key) {
  validateStorageKey(key)

  const fileName = path.basename(key, '.json') + '.json'
  return path.join(getStorageDir(userDataPath), encodeURIComponent(fileName))
}

function createElectronLocalStorage ({ getUserDataPath }) {
  function resolveFilePath (key) {
    return getStorageFilePath(getUserDataPath(), key)
  }

  return {
    get (key) {
      try {
        return createSuccessObject(JSON.parse(fs.readFileSync(resolveFilePath(key), 'utf8')))
      } catch (error) {
        return createErrorObject(error)
      }
    },

    set (key, data) {
      let filePath
      try {
        filePath = resolveFilePath(key)
      } catch (error) {
        return createErrorObject(error)
      }

      let stringifiedJson
      try {
        stringifiedJson = JSON.stringify(data)
      } catch (error) {
        return createErrorObject(error)
      }

      if (!stringifiedJson) {
        return createErrorObject(new Error('Invalid JSON object'))
      }

      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, stringifiedJson, 'utf8')
        return createSuccessObject(data)
      } catch (error) {
        return createErrorObject(error)
      }
    }
  }
}

module.exports = {
  createElectronLocalStorage,
  getStorageDir,
  getStorageFilePath
}
