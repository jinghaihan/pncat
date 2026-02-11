import { describe, expect, it } from 'vitest'
import { VltCatalog } from '@/catalog-handler/vlt-workspace'
import { createFixtureOptions } from '../_shared'

describe('loadWorkspace', () => {
  it('returns null when relative path is not vlt workspace file', async () => {
    const workspace = await VltCatalog.loadWorkspace('package.json', createFixtureOptions('vlt'), () => true)
    expect(workspace).toBeNull()
  })

  it('loads default and named catalogs from fixture', async () => {
    const loaded = await VltCatalog.loadWorkspace('vlt.json', createFixtureOptions('vlt'), () => true)
    expect(loaded?.map(item => item.name)).toEqual([
      'vlt-catalog:default',
      'vlt-catalog:build',
    ])
    expect(loaded?.flatMap(item => item.deps).every(dep => dep.source === 'vlt-workspace')).toBe(true)
  })
})
