import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'inlined',
      match: [
        '@antfu/utils',
        'deepmerge',
        'detect-indent',
        'diff',
        'get-npm-meta',
        'semver-es',
        'tildify',
        'yaml',
      ],
      priority: 0,
    },
  ]),
  postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',
})
