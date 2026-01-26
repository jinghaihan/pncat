import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index',
    'src/cli',
  ],
  clean: true,
  inlineOnly: false,
})
