import { defineConfig } from '@octohash/eslint-config'

export default defineConfig({
  markdown: false,
  antislop: false,
  ignores: [
    '**/test/fixtures/**',
  ],
})
