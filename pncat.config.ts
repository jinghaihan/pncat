import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'cli',
      match: ['@antfu/nip'],
    },
    {
      name: 'utils',
      match: ['fast-npm-meta', 'pnpm-workspace-yaml', 'yaml'],
    },
  ]),
})
