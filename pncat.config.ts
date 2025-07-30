import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'utils',
      match: ['fast-npm-meta', 'pnpm-workspace-yaml', 'yaml'],
    },
  ]),
})
