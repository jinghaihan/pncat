import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([]),
  exclude: ['@types/vscode'],
  postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',
})
