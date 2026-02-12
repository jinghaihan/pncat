import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index',
    'src/cli',
    'src/rules',
  ],
  dts: true,
  platform: 'node',
  inlineOnly: false,
  exports: true,
  clean: true,
})
