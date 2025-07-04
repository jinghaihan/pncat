import type { CatalogRule } from './types'

export const DEFAULT_CATALOG_RULES: CatalogRule[] = [
  {
    name: 'types',
    match: [/@types/],
    // depFields: ['devDependencies'],
    priority: 10,
  },
  {
    name: 'monorepo',
    match: [/lerna/, /changesets/, /nx/, /turbo/],
    priority: 20,
  },
  {
    name: 'test',
    match: [
      /vitest/,
      /jest/,
      /mocha/,
      /cypress/,
      /playwright/,
      /@vue\/test-utils/,
    ],
    priority: 20,
  },
  {
    name: 'lint',
    match: [
      /eslint/,
      /prettier/,
      /stylelint/,
      /biome/,
      /commitlint/,
      /lint-staged/,
      /husky/,
      /pre-commit/,
      /simple-git-hooks/,
      /cspell/,
    ],
    priority: 20,
  },
  {
    name: 'cli',
    match: [
      /taze/,
      /bumpp/,
      /commitizen/,
      /cz-git/,
      /czg/,
      /release-it/,
      /standard-version/,
      /@antfu\/nip/,
      /pncat/,
      /turnpress/,
      /shadcn-vue/,
    ],
    priority: 20,
  },
  {
    name: 'i18n',
    match: [/i18n/],
    priority: 30,
  },
  {
    name: 'node',
    match: [
      /cross-env/,
      /dotenv/,
      /pathe/,
      /enhanced-resolve/,
      /fs-extra/,
      /fast-glob/,
      /globby/,
      /cac/,
      /prompts/,
      /execa/,
      /tinyexec/,
      /rimraf/,
      /find-up/,
      /ora/,
      /chalk/,
      /ansis/,
      /consola/,
      /pkg-types/,
      /local-pkg/,
      /unconfig/,
      /synckit/,
    ],
    priority: 30,
  },
  {
    name: 'utils',
    match: [
      /lodash/,
      /radash/,
      /dayjs/,
      /zod/,
      /semver/,
      /cheerio/,
      /qs/,
      /nanoid/,
      /magic-string/,
      /deepmerge/,
      /defu/,
      /@vueuse\//,
      /clsx/,
      /class-variance-authority/,
      /dagre/,
      /graphlib/,
    ],
    priority: 30,
  },
  {
    name: 'network',
    match: [/axios/, /fetch-event-source/, /fetch-event-stream/],
    priority: 30,
  },
  {
    name: 'script',
    match: [/tsx/, /jiti/, /esno/],
    priority: 40,
  },
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
      /tsdown/,
      /rspack/,
      /unplugin/,
    ],
    priority: 40,
  },
  {
    name: 'icons',
    match: [/iconify/, /icon/, /lucide/],
    priority: 50,
  },
  {
    name: 'syntax',
    match: [/shiki/, /prismjs/, /highlight\.js/],
    priority: 50,
  },
  {
    name: 'markdown',
    match: [/markdown-it/, /markdown/, /turndown/],
    priority: 50,
  },
  {
    name: 'style',
    match: [
      /postcss/,
      /autoprefixer/,
      /less/,
      /sass/,
      /tailwindcss/,
      /unocss/,
      /windicss/,
      /purgecss/,
      /tailwindcss-animate/,
      /tailwind-merge/,
      /tw-animate-css/,
      /typography/,
    ],
    priority: 50,
  },
  {
    name: 'frontend',
    match: [
      /nprogress/,
      /swiper/,
      /tippy/,
      /monaco-editor/,
      /codemirror/,
      /xterm/,
      /sortablejs/,
      /draggable/,
      /moveable/,
      /echarts/,
      /d3/,
      /three/,
      /leaflet/,
      /^vue$/,
      /vue-router/,
      /vuex/,
      /pinia/,
      /ant-design/,
      /element-plus/,
      /naive-ui/,
      /vuetify/,
      /radix-vue/,
      /reka-ui/,
      /logicflow/,
      /vue-flow/,
    ],
    priority: 60,
  },
  {
    name: 'backend',
    match: [/express/, /koa/, /drizzle/],
    priority: 70,
  },
]
