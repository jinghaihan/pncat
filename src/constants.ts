import type { CatalogOptions, CatalogRule, CommonOptions, DepType } from './types'

export const MODE_CHOICES = ['detect', 'migrate', 'add', 'remove', 'clean', 'revert'] as const

export const DEPS_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'packageManager',
  'pnpm.overrides',
  'resolutions',
  'overrides',
  'pnpm-workspace',
] as const

export const DEFAULT_CATALOG_RULES: CatalogRule[] = [
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
      /(^|\/)eslint(-|$)/,
      /(^|\/)prettier(-|$)/,
      /^stylelint$/,
      /^commitlint$/,
      /^lint-staged$/,
      /^biome$/,
    ],
  },

  // Build Tools
  {
    name: 'build',
    match: [
      /^vite$/,
      /^webpack$/,
      /^rollup$/,
      /^rolldown$/,
      /^esbuild$/,
      /^unbuild$/,
      /^tsup$/,
      /^rspack$/,
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

  // Type Definitions
  {
    name: 'types',
    match: [
      /^@types\//,
    ],
    depFields: ['devDependencies'], // typically in devDependencies
  },
]

export const DEFAULT_COMMON_OPTIONS: CommonOptions = {
  cwd: '',
  recursive: true,
  force: false,
  ignorePaths: '',
  ignoreOtherWorkspaces: true,
  include: '',
  exclude: '',
  depFields: {
    packageManager: false,
  },
  allowedProtocols: ['workspace', 'link', 'file'],
  catalogRules: DEFAULT_CATALOG_RULES,
}

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  ...DEFAULT_COMMON_OPTIONS,
  mode: 'detect',
  yes: false,
}

export const DEFAULT_IGNORE_PATHS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/public/**',
  '**/fixture/**',
  '**/fixtures/**',
]

export const DEP_TYPE_GROUP_NAME_MAP: Partial<Record<DepType, string>> = {
  dependencies: 'prod',
  devDependencies: 'dev',
  peerDependencies: 'peer',
  optionalDependencies: 'optional',
}
