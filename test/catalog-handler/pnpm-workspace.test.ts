import { describe, expect, it } from 'vitest'
import { PnpmCatalog } from '@/catalog-handler/pnpm-workspace'
import { createFixtureOptions, createFixtureScenarioOptions } from '../_shared'

describe('loadWorkspace', () => {
  it('returns null when relative path is not pnpm workspace file', async () => {
    const workspace = await PnpmCatalog.loadWorkspace(
      'package.json',
      createFixtureOptions(),
      () => true,
    )
    expect(workspace).toBeNull()
  })

  it('loads pnpm workspace entries from fixture', async () => {
    const workspace = await PnpmCatalog.loadWorkspace(
      'pnpm-workspace.yaml',
      createFixtureOptions(),
      () => true,
    )
    expect(workspace?.map(item => item.name)).toEqual([
      'pnpm-catalog:default',
      'pnpm-catalog:test',
      'pnpm-workspace:overrides',
    ])
  })
})

describe('updateWorkspaceOverrides', () => {
  it('updates overrides via direct matches, catalog matches, and raw fallback', async () => {
    const catalog = new PnpmCatalog(createFixtureScenarioOptions('pnpm-update-overrides'))
    await catalog.ensureWorkspace()
    await catalog.clearCatalogs()
    await catalog.setPackage('default', 'react', '^18.3.1')
    await catalog.setPackage('test', 'vue', '^3.5.0')
    await catalog.setPackage('modern', 'svelte', '~5.0.0')

    await catalog.updateWorkspaceOverrides()
    await expect(catalog.toJSON()).resolves.toMatchObject({
      overrides: {
        react: 'catalog:default',
        vue: 'catalog:test',
        svelte: 'catalog:modern',
        solid: '~1.0.0',
      },
    })
  })
})
