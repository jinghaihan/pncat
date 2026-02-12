import type { DepType, PackageManager, PackageManagerConfig } from '@/types'

export const PACKAGE_MANAGERS = ['pnpm', 'yarn', 'bun', 'vlt'] as const

export const COMMON_DEPS_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

export const OVERRIDE_DEPS_FIELDS = [
  'pnpm.overrides',
  'resolutions',
  'overrides',
] as const

export const WORKSPACE_DEPS_FIELDS = [
  'pnpm-workspace',
  'yarn-workspace',
  'bun-workspace',
  'vlt-workspace',
] as const

export const DEPS_FIELDS = [
  ...COMMON_DEPS_FIELDS,
  ...OVERRIDE_DEPS_FIELDS,
  ...WORKSPACE_DEPS_FIELDS,
] as const

export const DEPS_TYPE_CATALOG_MAP: Record<DepType, string> = {
  'dependencies': 'prod',
  'devDependencies': 'dev',
  'peerDependencies': 'peer',
  'optionalDependencies': 'optional',
  'overrides': 'override',
  'yarn-workspace': 'override',
  'bun-workspace': 'override',
  'vlt-workspace': 'override',
  'pnpm.overrides': 'override',
  'resolutions': 'override',
  'pnpm-workspace': 'override',
}

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

export const PACKAGE_MANAGER_CONFIG: Record<PackageManager, PackageManagerConfig> = {
  pnpm: {
    type: 'pnpm-workspace.yaml',
    depType: 'pnpm-workspace',
    filename: 'pnpm-workspace.yaml',
    locks: ['pnpm-lock.yaml'],
    defaultContent: 'packages: []',
  },
  yarn: {
    type: '.yarnrc.yml',
    depType: 'yarn-workspace',
    filename: '.yarnrc.yml',
    locks: ['yarn.lock'],
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
    locks: ['vlt-lock.json'],
    defaultContent: '{}',
  },
}
