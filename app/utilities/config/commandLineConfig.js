function isOption (arg) {
  return typeof arg === 'string' && arg.startsWith('--') && arg.length > 2
}

function splitKeyPath (key) {
  return key.split(/[.:]/).filter(Boolean)
}

function camelCasePathSegment (segment) {
  return segment.replace(/-([a-zA-Z0-9])/g, (match, character) => character.toUpperCase())
}

function getConfigKeyPaths (key) {
  const path = splitKeyPath(key)
  const camelCasePath = path.map(camelCasePathSegment)

  if (path.join(':') === camelCasePath.join(':')) {
    return [path]
  }

  return [path, camelCasePath]
}

function parseOptionValue (value) {
  if (typeof value !== 'string') {
    return value
  }

  if (/^-?(?:(?:0|[1-9]\d*)(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    return Number(value)
  }

  return value
}

function setNestedConfigValue (config, key, value) {
  for (const path of getConfigKeyPaths(key)) {
    setNestedPathValue(config, path, value)
  }
}

function setNestedPathValue (config, path, value) {
  if (path.length === 0) return

  let cursor = config
  for (let index = 0; index < path.length - 1; index++) {
    const segment = path[index]
    if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      cursor[segment] = {}
    }
    cursor = cursor[segment]
  }

  const leaf = path[path.length - 1]
  if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
    cursor[leaf] = Array.isArray(cursor[leaf])
      ? cursor[leaf].concat(value)
      : [cursor[leaf], value]
    return
  }

  cursor[leaf] = value
}

function parseCommandLineConfig (argv = process.argv.slice(2)) {
  const config = {}

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--') break
    if (!isOption(arg)) continue

    const option = arg.slice(2)
    const equalsIndex = option.indexOf('=')

    if (equalsIndex !== -1) {
      setNestedConfigValue(
        config,
        option.slice(0, equalsIndex),
        parseOptionValue(option.slice(equalsIndex + 1))
      )
      continue
    }

    if (option.startsWith('no-') && option.length > 3) {
      setNestedConfigValue(config, option.slice(3), false)
      continue
    }

    const nextArg = argv[index + 1]
    if (typeof nextArg === 'string' && !isOption(nextArg)) {
      setNestedConfigValue(config, option, parseOptionValue(nextArg))
      index++
      continue
    }

    setNestedConfigValue(config, option, true)
  }

  return config
}

module.exports = {
  parseCommandLineConfig
}
