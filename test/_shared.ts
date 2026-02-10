import type { CatalogOptions, PackageManager } from '../src/types'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import { DEFAULT_CATALOG_OPTIONS } from '../src/constants'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(TEST_DIR, 'fixtures')
const SNAPSHOTS_DIR = join(TEST_DIR, 'snapshots')

export function getFixtureCwd(agent: PackageManager): string {
  return join(FIXTURES_DIR, agent)
}

export function getFixturePath(...paths: string[]): string {
  return join(FIXTURES_DIR, ...paths)
}

export function getSnapshotPath(...paths: string[]): string {
  return join(SNAPSHOTS_DIR, ...paths)
}

export function createFixtureOptions(
  agent: PackageManager,
  overrides: Partial<CatalogOptions> = {},
): CatalogOptions {
  const baseOptions = DEFAULT_CATALOG_OPTIONS

  return {
    ...baseOptions,
    depFields: { ...baseOptions.depFields },
    specifierOptions: { ...baseOptions.specifierOptions },
    cwd: getFixtureCwd(agent),
    agent,
    ...overrides,
  }
}
