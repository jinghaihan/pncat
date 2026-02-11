import type { CatalogOptions, PackageManager } from '@/types'
import { fileURLToPath } from 'node:url'
import deepmerge from 'deepmerge'
import { dirname, join, normalize } from 'pathe'
import { DEFAULT_CATALOG_OPTIONS } from '@/constants'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(TEST_DIR, 'fixtures')
const SNAPSHOTS_DIR = join(TEST_DIR, 'snapshots')

/// keep-sorted
const FIXTURE_SCENARIOS = {
  'bun-no-catalog': {
    agent: 'bun',
    path: ['scenarios', 'bun-no-catalog'],
  },
  'bun-no-lock': {
    agent: 'bun',
    path: ['scenarios', 'bun-no-lock'],
  },
  'command-add': {
    agent: 'pnpm',
    path: ['scenarios', 'command-add'],
  },
  'command-clean': {
    agent: 'pnpm',
    path: ['scenarios', 'command-clean'],
  },
  'command-detect-noop': {
    agent: 'pnpm',
    path: ['scenarios', 'command-detect-noop'],
  },
  'command-detect': {
    agent: 'pnpm',
    path: ['scenarios', 'command-detect'],
  },
  'command-init': {
    agent: 'pnpm',
    path: ['scenarios', 'command-init'],
  },
  'command-migrate': {
    agent: 'pnpm',
    path: ['scenarios', 'command-migrate'],
  },
  'command-remove': {
    agent: 'pnpm',
    path: ['scenarios', 'command-remove'],
  },
  'command-revert': {
    agent: 'pnpm',
    path: ['scenarios', 'command-revert'],
  },
  'command-shared': {
    agent: 'pnpm',
    path: ['scenarios', 'command-shared'],
  },
  'config-file': {
    agent: 'pnpm',
    path: ['scenarios', 'config-file'],
  },
  'no-dependencies': {
    agent: 'pnpm',
    path: ['scenarios', 'no-dependencies'],
  },
  'pnpm-empty-workspace': {
    agent: 'pnpm',
    path: ['scenarios', 'pnpm-empty-workspace'],
  },
  'pnpm-update-overrides': {
    agent: 'pnpm',
    path: ['scenarios', 'pnpm-update-overrides'],
  },
  'unnamed-package': {
    agent: 'pnpm',
    path: ['scenarios', 'unnamed-package'],
  },
  'workspace-filter': {
    agent: 'pnpm',
    path: ['scenarios', 'workspace-filter'],
  },
} as const

type FixtureScenario = keyof typeof FIXTURE_SCENARIOS

export function getFixtureCwd(agent: PackageManager): string {
  return join(FIXTURES_DIR, agent)
}

export function getFixturePath(...paths: string[]): string {
  return join(FIXTURES_DIR, ...paths)
}

export function toFixtureSnapshotPath(path: string): string {
  const normalizedPath = normalize(path)
  const normalizedFixturesDir = normalize(FIXTURES_DIR)
  if (normalizedPath === normalizedFixturesDir)
    return '<fixtures>'

  if (normalizedPath.startsWith(`${normalizedFixturesDir}/`))
    return `<fixtures>/${normalizedPath.slice(normalizedFixturesDir.length + 1)}`

  return normalizedPath
}

export function getFixtureScenarioPath(scenario: FixtureScenario): string {
  return getFixturePath(...FIXTURE_SCENARIOS[scenario].path)
}

export function createFixtureScenarioOptions(
  scenario: FixtureScenario,
  overrides: Partial<CatalogOptions> = {},
): CatalogOptions {
  const { agent } = FIXTURE_SCENARIOS[scenario]
  return createFixtureOptions(agent, { cwd: getFixtureScenarioPath(scenario), ...overrides })
}

export function getSnapshotPath(...paths: string[]): string {
  return join(SNAPSHOTS_DIR, ...paths)
}

export function createFixtureOptions(
  agent: PackageManager = 'pnpm',
  overrides: Partial<CatalogOptions> = {},
): CatalogOptions {
  const fixtureOptions = { cwd: getFixtureCwd(agent), agent }
  return deepmerge(deepmerge(DEFAULT_CATALOG_OPTIONS, fixtureOptions), overrides)
}
