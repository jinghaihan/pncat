import { defineConfig } from '@octohash/eslint-config'

export default defineConfig({
  markdown: false,
  ignores: [
    '**/test/fixtures/**',
  ],
})
