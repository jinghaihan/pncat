import type { CatalogRule } from './types'

export const DEFAULT_CATALOG_RULES: CatalogRule[] = [
  {
    name: 'types',
    match: [/^@types\//],
    // depFields: ['devDependencies'],
    priority: 10,
  },
  {
    name: 'test',
    match: [/^vitest$/, /^jest$/, /^mocha$/, /^cypress$/, /^playwright$/],
    priority: 20,
  },
  {
    name: 'lint',
    match: [/eslint/, /prettier/, /stylelint/, /biome/, /commitlint/, /^lint-staged$/],
    priority: 20,
  },
  {
    name: 'i18n',
    match: [/i18n/],
    priority: 30,
  },
  {
    name: 'build',
    match: [/vite/, /webpack/, /rollup/, /rolldown/, /esbuild/, /unbuild/, /tsup/, /rspack/, /unplugin/],
    priority: 40,
  },
  {
    name: 'script',
    match: [/^tsx$/, /^esno$/],
    priority: 40,
  },
  {
    name: 'style',
    match: [/postcss/, /less/, /sass/, /tailwindcss/, /unocss/, /purgecss/],
    priority: 50,
  },
  {
    name: 'frontend',
    match: [/^vue$/, /^vue-router$/, /^vuex$/, /^pinia$/, /^element-plus$/, /^ant-design-vue$/, /^vuetify$/, /^naive-ui$/, /^echarts$/],
    priority: 60,
  },
  {
    name: 'utils',
    match: [/^lodash/, /^dayjs$/, /^@vueuse\//],
    priority: 30,
  },
  {
    name: 'icons',
    match: [/^@iconify\//, /^iconify$/, /^lucide$/, /icon/],
    priority: 50,
  },
  {
    name: 'markdown',
    match: [/markdown-it/],
    priority: 50,
  },
  {
    name: 'backend',
    match: [/^express$/, /^koa$/],
    priority: 70,
  },
]
