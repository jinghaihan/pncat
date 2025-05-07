import type { CatalogRule } from './types'

export const DEFAULT_CATALOG_RULES: CatalogRule[] = [
  // Type Definitions
  {
    name: 'types',
    match: [
      /^@types\//,
    ],
    depFields: ['devDependencies'], // typically in devDependencies
  },

  // Test Frameworks
  {
    name: 'test',
    match: [
      /^vitest$/,
      /^jest$/,
      /^mocha$/,
      /^cypress$/,
      /^playwright$/,
    ],
  },

  // Linting Tools
  {
    name: 'lint',
    match: [
      /eslint/,
      /prettier/,
      /stylelint/,
      /biome/,
      /commitlint/,
      /^lint-staged$/,
    ],
  },

  // Build Tools
  {
    name: 'build',
    match: [
      /vite/,
      /webpack/,
      /rollup/,
      /rolldown/,
      /esbuild/,
      /unbuild/,
      /tsup/,
      /rspack/,
    ],
  },

  // Script Execution Tools
  {
    name: 'script',
    match: [
      /^tsx$/,
      /^esno$/,
    ],
  },

  // Frontend Libraries
  {
    name: 'frontend',
    match: [
      /^vue$/,
      /^vue-router$/,
      /^vuex$/,
      /^pinia$/,
      /^element-plus$/,
      /^ant-design-vue$/,
      /^vuetify$/,
      /^naive-ui$/,
      /^echarts$/,
    ],
  },

  // Icons Libraries
  {
    name: 'icons',
    match: [
      /^@iconify\//,
      /^iconify$/,
      /^lucide$/,
      /icon/,
    ],
  },

  // Backend Libraries
  {
    name: 'backend',
    match: [
      /^express$/,
      /^koa$/,
    ],
  },
]
