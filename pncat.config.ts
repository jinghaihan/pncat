import { defineConfig, mergeCatalogRules } from './src'

export default defineConfig({
  postRun: 'eslint --fix .',
  catalogRules: mergeCatalogRules([
    {
      name: 'node',
      match: [
        'fast-npm-meta',
        'pnpm-workspace-yaml',
        'package-manager-detector',
      ],
    },
    {
      name: 'utils',
      match: [
        'diff',
        'detect-indent',
      ],
    },
  ]),
})
