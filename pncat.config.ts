import { defineConfig, mergeCatalogRules } from './src'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'utils',
      match: [
        'diff',
        'fast-npm-meta',
        'pnpm-workspace-yaml',
        'package-manager-detector',
        'detect-indent',
      ],
    },
  ]),
})
