import type { CatalogOptions } from '../types'

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  mode: 'detect',
  recursive: true,
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
  },
  yes: false,
  saveExact: false,
  install: true,
}

export const DEFAULT_IGNORE_PATHS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/public/**',
  '**/fixture/**',
  '**/fixtures/**',
]
