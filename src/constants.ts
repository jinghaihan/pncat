import type { Agent, AgentConfig, CatalogOptions, DepType, RangeMode } from './types'
import pkgJson from '../package.json'

export const NAME = pkgJson.name

export const VERSION = pkgJson.version

export const MODE_CHOICES = ['init', 'detect', 'migrate', 'add', 'remove', 'clean', 'revert'] as const

export const MODE_ALIASES: Partial<Record<RangeMode, string[]>> = {
  init: ['create', 'setup', 'config', 'conf'],
  detect: ['scan', 'check', 'find', 'd'],
  migrate: ['move', 'mv', 'mig', 'm'],
  add: ['install', 'in', 'i'],
  remove: ['uninstall', 'rm', 'r', 'un', 'u'],
  clean: ['prune', 'cl', 'c'],
  revert: ['restore', 'undo', 'rev'],
}

export const AGENTS = ['pnpm', 'yarn', 'bun', 'vlt'] as const

export const AGENT_CONFIG: Record<Agent, AgentConfig> = {
  pnpm: {
    workspaceType: 'pnpm-workspace.yaml',
    filename: 'pnpm-workspace.yaml',
    lock: 'pnpm-lock.yaml',
    defaultContent: 'packages: []',
  },
  yarn: {
    workspaceType: '.yarnrc.yml',
    filename: '.yarnrc.yml',
    lock: 'yarn.lock',
    defaultContent: 'defaultProtocol: "npm:"',
  },
  bun: {
    workspaceType: 'bun-workspace',
    filename: 'package.json',
    lock: ['bun.lockb', 'bun.lock'],
    defaultContent: '',
  },
  vlt: {
    workspaceType: 'vlt.json',
    filename: 'vlt.json',
    lock: 'vlt-lock.json',
    defaultContent: '{}',
  },
}

export const CMD_BOOL_FLAGS = new Set(['save-dev', 'save-peer', 'save-optional', 'save-exact', 'recursive'])

export const CMD_BOOL_SHORT_FLAGS = new Set(['D', 'P', 'O', 'E', 'r'])

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
  dependencies: 'prod',
  devDependencies: 'dev',
  peerDependencies: 'peer',
  optionalDependencies: 'optional',
}
