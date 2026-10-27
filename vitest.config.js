import { defineConfig } from 'vitest/config'
import { transformSync } from '@babel/core'
import presetReact from '@babel/preset-react'

export default defineConfig({
  plugins: [{
    name: 'lepton-jsx-in-js',
    enforce: 'pre',
    transform (code, id) {
      if (!/\/app\/containers\/.*\.js$/.test(id)) return
      return transformSync(code, {
        babelrc: false,
        configFile: false,
        filename: id,
        presets: [presetReact],
        sourceMaps: true
      })
    }
  }],
  test: {
    clearMocks: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
    testTimeout: 10000
  }
})
