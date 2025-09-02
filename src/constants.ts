import type { CatalogOptions, DepType } from './types'

export const MODE_CHOICES = ['detect', 'migrate', 'add', 'remove', 'clean', 'revert'] as const

export const DEPS_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'pnpm.overrides',
  'resolutions',
  // 'overrides',
  'pnpm-workspace',
] as const

export const DEPENDENCIES_TYPE_SHORT_MAP: Record<DepType, string> = {
  'dependencies': '',
  'devDependencies': 'dev',
  'peerDependencies': 'peer',
  'optionalDependencies': 'optional',
  'resolutions': 'resolutions',
  // 'overrides': 'overrides',
  'pnpm.overrides': 'pnpm-overrides',
  'pnpm-workspace': 'pnpm-workspace',
}

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  mode: 'detect',
  recursive: true,
  force: false,
  ignoreOtherWorkspaces: true,
  depFields: {
    dependencies: true,
    devDependencies: true,
    peerDependencies: true,
  },
  allowedProtocols: ['workspace', 'link', 'file'],
  specifierOptions: {
    skipComplexRanges: true,
    allowPreReleases: true,
    allowWildcards: false,
  },
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
