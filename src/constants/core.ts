import type { CatalogOptions, DepType } from '@/types'

export const CLI_DEP_FIELD_ALIASES: Record<DepType, readonly string[]> = {
  'dependencies': ['prod'],
  'devDependencies': ['dev', 'dev-dependencies'],
  'peerDependencies': ['peer', 'peer-dependencies'],
  'optionalDependencies': ['optional', 'optional-dependencies'],
  'pnpm.overrides': ['pnpm-overrides'],
  'resolutions': ['resolution'],
  'overrides': ['override'],
  'pnpm-workspace': [],
  'yarn-workspace': [],
  'bun-workspace': [],
  'vlt-workspace': [],
}

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  mode: 'detect',
  recursive: true,
  anon: false,
  force: false,
  ignoreOtherWorkspaces: true,
  depFields: {
    'dependencies': true,
    'devDependencies': true,
    'peerDependencies': true,
    'optionalDependencies': true,
    'resolutions': true,
    'overrides': true,
    'pnpm.overrides': true,
  },
  allowedProtocols: ['workspace', 'link', 'file'],
  specifierOptions: {
    skipComplexRanges: true,
    allowPreReleases: true,
    allowWildcards: false,
    allowNpmAliases: true,
  },
  yes: false,
  saveExact: false,
  install: true,
}

export const DEFAULT_IGNORE_PATHS = ['**/node_modules/**']
