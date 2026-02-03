import type { Agent, AgentConfig, CatalogOptions, DepType, RangeMode } from './types'
import pkgJson from '../package.json'

export const NAME = pkgJson.name

export const VERSION = pkgJson.version

export const MODE_CHOICES = [
  'init',
  'detect',
  'migrate',
  'add',
  'remove',
  'clean',
  'revert',
  'fix',
] as const

export const MODE_ALIASES: Partial<Record<RangeMode, string[]>> = {
  init: ['create', 'setup', 'config', 'conf'],
  detect: ['scan', 'check', 'find', 'd'],
  migrate: ['move', 'mv', 'mig', 'm'],
  add: ['install', 'in', 'i'],
  remove: ['uninstall', 'rm', 'r', 'un', 'u'],
  clean: ['prune', 'cl', 'c'],
  revert: ['restore', 'undo', 'rev'],
  fix: ['f'],
}

export const AGENTS = ['pnpm', 'yarn', 'bun', 'vlt'] as const

export const AGENT_CONFIG: Record<Agent, AgentConfig> = {
  pnpm: {
    type: 'pnpm-workspace.yaml',
    depType: 'pnpm-workspace',
    filename: 'pnpm-workspace.yaml',
    locks: 'pnpm-lock.yaml',
    defaultContent: 'packages: []',
  },
  yarn: {
    type: '.yarnrc.yml',
    depType: 'yarn-workspace',
    filename: '.yarnrc.yml',
    locks: 'yarn.lock',
    defaultContent: 'defaultProtocol: "npm:"',
  },
  bun: {
    type: 'bun-workspace',
    depType: 'bun-workspace',
    filename: 'package.json',
    locks: ['bun.lockb', 'bun.lock'],
    defaultContent: '',
  },
  vlt: {
    type: 'vlt.json',
    depType: 'vlt-workspace',
    filename: 'vlt.json',
    locks: 'vlt-lock.json',
    defaultContent: '{}',
  },
} as const

export const CMD_BOOL_FLAGS = new Set([
  'save-dev',
  'save-peer',
  'save-optional',
  'save-exact',
  'recursive',
])

export const CMD_BOOL_SHORT_FLAGS = new Set(['D', 'P', 'O', 'E', 'r'])

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

export const COMMON_DEPS_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

export const DEPS_FIELDS = [
  ...COMMON_DEPS_FIELDS,
  'pnpm.overrides',
  'resolutions',
  'overrides',
  'pnpm-workspace',
  'yarn-workspace',
  'bun-workspace',
  'vlt-workspace',
] as const

export const DEPS_TYPE_SHORT_MAP: Record<DepType, string> = {
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
  'vlt-workspace': 'vlt-workspace',
}

export const DEPS_TYPE_CATALOG_MAP: Partial<Record<DepType, string>> = {
  'dependencies': 'prod',
  'devDependencies': 'dev',
  'peerDependencies': 'peer',
  'optionalDependencies': 'optional',
  'pnpm.overrides': 'override',
  'resolutions': 'override',
  'pnpm-workspace': 'override',
}
