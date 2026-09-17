import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    maxConcurrency: 1,
    silent: true,
    reporters: 'verbose'
  },
  env: {
    MODE: 'test'
  }
})
