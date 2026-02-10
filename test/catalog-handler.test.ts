import type { DepFilter, PackageManager } from '../src/types'
import { describe, expect, it } from 'vitest'
import { catalogHandlers } from '../src/catalog-handler'
import { PACKAGE_MANAGER_CONFIG, PACKAGE_MANAGERS } from '../src/constants'
import { createFixtureOptions, getFixturePath } from './_shared'

const shouldCatalog: DepFilter = () => true

describe('catalog-handler/loadWorkspace', () => {
  it('loads expected workspace entries for each manager fixture', async () => {
    const expectedNames: Record<PackageManager, string[]> = {
      pnpm: ['pnpm-catalog:default', 'pnpm-catalog:test', 'pnpm-workspace:overrides'],
      yarn: ['yarn-catalog:default', 'yarn-catalog:lint'],
      bun: ['bun-catalog:default', 'bun-catalog:test', 'fixture-bun'],
      vlt: ['vlt-catalog:default', 'vlt-catalog:build'],
    }

    for (const agent of PACKAGE_MANAGERS) {
      const options = createFixtureOptions(agent)
      const filename = PACKAGE_MANAGER_CONFIG[agent].filename
      const workspace = await catalogHandlers[agent].loadWorkspace(filename, options, shouldCatalog)

      expect(workspace).not.toBeNull()
      expect(workspace?.map(item => item.name)).toEqual(expectedNames[agent])
    }
  })

  it('returns null for non-workspace relative paths', async () => {
    for (const agent of PACKAGE_MANAGERS) {
      const options = createFixtureOptions(agent)
      const workspace = await catalogHandlers[agent].loadWorkspace('packages/app/package.json', options, shouldCatalog)
      expect(workspace).toBeNull()
    }
  })

  it('bun returns null when lockfile is missing', async () => {
    const workspace = await catalogHandlers.bun.loadWorkspace(
      'package.json',
      createFixtureOptions('bun', { cwd: getFixturePath('bun-no-lock') }),
      shouldCatalog,
    )
    expect(workspace).toBeNull()
  })

  it('bun returns null when lockfile exists but no workspace catalogs', async () => {
    const workspace = await catalogHandlers.bun.loadWorkspace(
      'package.json',
      createFixtureOptions('bun', { cwd: getFixturePath('bun-no-catalog') }),
      shouldCatalog,
    )
    expect(workspace).toBeNull()
  })
})
