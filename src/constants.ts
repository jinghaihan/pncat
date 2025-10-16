import type { CatalogOptions, DepType, PackageManager, WorkspaceMeta } from './types'

export const MODE_CHOICES = ['init', 'detect', 'migrate', 'add', 'remove', 'clean', 'revert'] as const

export const ADD_MODE_ALIAS = ['install', 'i']
export const REMOVE_MODE_ALIAS = ['uninstall', 'rm', 'un']

export const DEPS_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'pnpm.overrides',
  'resolutions',
  'overrides',
  'pnpm-workspace',
  'yarn-workspace',
  'bun-workspace',
] as const

export const DEPENDENCIES_TYPE_SHORT_MAP: Record<DepType, string> = {
  'dependencies': '',
  'devDependencies': 'dev',
  'peerDependencies': 'peer',
  'optionalDependencies': 'optional',
  'resolutions': 'resolutions',
  'overrides': 'overrides',
  'pnpm.overrides': 'pnpm-overrides',
  'pnpm-workspace': 'pnpm-workspace',
  'yarn-workspace': 'yarn-workspace',
  'bun-workspace': 'bun-workspace',
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

export const PACKAGE_MANAGERS = ['pnpm', 'yarn', 'bun'] as const

export const WORKSPACE_META: Record<PackageManager, WorkspaceMeta> = {
  pnpm: {
    type: 'pnpm-workspace.yaml',
    lockFile: 'pnpm-lock.yaml',
    defaultContent: 'packages: []',
  },
  yarn: {
    type: '.yarnrc.yml',
    lockFile: 'yarn.lock',
    defaultContent: 'defaultProtocol: "npm:"',
  },
  bun: {
    type: 'bun-workspace',
    lockFile: ['bun.lockb', 'bun.lock'],
    defaultContent: '',
  },
}
