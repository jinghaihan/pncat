import { defineConfig, mergeCatalogRules } from './src'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'npm',
      match: [
        '@npmcli/config',
        'npm-package-arg',
        'npm-registry-fetch',
        'fast-npm-meta',
      ],
      priority: 0,
    },
    {
      name: 'node',
      match: [
        'pnpm-workspace-yaml',
        'package-manager-detector',
      ],
    },
  ]),
  postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',
})
