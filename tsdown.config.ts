import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index',
    'src/cli',
    'src/rules',
  ],
  clean: true,
  inlineOnly: false,
})
