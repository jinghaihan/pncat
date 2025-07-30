import type { CatalogOptions, CommonOptions, DepType } from './types'
import { DEFAULT_CATALOG_RULES } from './rules'

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
  specifierOptions: {
    skipComplexRanges: true,
    allowPreReleases: true,
    allowWildcards: false,
  },
}

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  ...DEFAULT_COMMON_OPTIONS,
  mode: 'detect',
  yes: false,
  install: true,
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
