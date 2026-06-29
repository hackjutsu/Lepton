import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
    testTimeout: 10000
  }
})
