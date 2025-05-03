import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'inlined',
      match: ['@antfu/utils'],
    },
  ]),
})
