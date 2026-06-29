module.exports = function stripSolidityModuleShim (source) {
  return source.replace(
    'var module = module ? module : {};     // shim for browser use',
    '// Webpack provides the CommonJS module object.'
  )
}
