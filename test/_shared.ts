import type { CatalogOptions, PackageManager } from '../src/types'
import { fileURLToPath } from 'node:url'
import { dirname } from 'pathe'
import { DEFAULT_CATALOG_OPTIONS } from '../src/constants'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))

export function getFixtureCwd(agent: PackageManager): string {
  return `${TEST_DIR}/fixtures/${agent}`
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
