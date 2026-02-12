import { defineConfig, mergeCatalogRules } from 'pncat'

export default defineConfig({
  catalogRules: mergeCatalogRules([
    {
      name: 'inlined',
      match: [
        '@antfu/utils',
        '@npmcli/config',
        'deepmerge',
        'detect-indent',
        'diff',
        'fast-npm-meta',
        'npm-package-arg',
        'npm-registry-fetch',
        'p-retry',
        'semver',
        'tildify',
        'ufo',
      ],
    },
  ]),
  postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',
})
