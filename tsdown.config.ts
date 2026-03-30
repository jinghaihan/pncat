import { defineConfig } from 'tsdown'
import { semverAliasPlugin } from './build/semver'

export default defineConfig({
  entry: [
    'src/index',
    'src/cli',
    'src/rules',
  ],
  dts: true,
  platform: 'node',
  deps: {
    onlyBundle: false,
  },
  plugins: [
    semverAliasPlugin(),
  ],
  exports: true,
  clean: true,
})
