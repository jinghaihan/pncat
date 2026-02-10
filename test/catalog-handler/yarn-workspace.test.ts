import { describe, expect, it } from 'vitest'
import { YarnCatalog } from '../../src/catalog-handler/yarn-workspace'
import { createFixtureOptions } from '../_shared'

describe('loadWorkspace', () => {
  it('returns null when relative path is not yarn workspace file', async () => {
    const workspace = await YarnCatalog.loadWorkspace(
      'package.json',
      createFixtureOptions('yarn'),
      () => true,
    )

    expect(workspace).toBeNull()
  })

  it('loads yarn workspace entries from fixture', async () => {
    const workspace = await YarnCatalog.loadWorkspace(
      '.yarnrc.yml',
      createFixtureOptions('yarn'),
      () => true,
    )

    expect(workspace?.map(item => item.name)).toEqual([
      'yarn-catalog:default',
      'yarn-catalog:lint',
    ])
  })

  it('parses deps as yarn-workspace source', async () => {
    const workspace = await YarnCatalog.loadWorkspace(
      '.yarnrc.yml',
      createFixtureOptions('yarn'),
      () => true,
    )

    expect(workspace?.every(item => item.type === '.yarnrc.yml')).toBe(true)
    expect(workspace?.flatMap(item => item.deps).every(dep => dep.source === 'yarn-workspace')).toBe(true)
  })
})
