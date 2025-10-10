import { defineConfig, mergeCatalogRules } from './src'

export default defineConfig({
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
  postRun: 'eslint --fix .',
})
