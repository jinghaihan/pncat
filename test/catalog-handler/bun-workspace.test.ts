import { join, normalize } from 'pathe'
import { describe, expect, it } from 'vitest'
import { BunCatalog } from '@/catalog-handler/bun-workspace'
import { createFixtureOptions, createFixtureScenarioOptions, getFixturePath, getFixtureScenarioPath } from '../_shared'

describe('hasWorkspaceCatalog', () => {
  it('returns false for invalid workspace values', () => {
    expect(BunCatalog.hasWorkspaceCatalog({})).toBe(false)
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: ['packages/*'] })).toBe(false)
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: null })).toBe(false)
  })

  it('returns true when workspace catalog fields exist', () => {
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: { catalog: {} } })).toBe(true)
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: { catalogs: {} } })).toBe(true)
  })
})

describe('findWorkspaceFile', () => {
  it('returns bun workspace filepath when workspace catalog exists', async () => {
    const catalog = new BunCatalog(createFixtureOptions('bun'))
    expect(normalize((await catalog.findWorkspaceFile())!)).toBe(normalize(getFixturePath('bun', 'package.json')))
  })

  it('returns undefined when workspace catalog does not exist', async () => {
    const catalog = new BunCatalog(createFixtureScenarioOptions('bun-no-catalog'))
    await expect(catalog.findWorkspaceFile()).resolves.toBeUndefined()
  })
})

describe('ensureWorkspace', () => {
  it('falls back to workspace root package.json when workspace file is missing', async () => {
    const scenarioRoot = getFixtureScenarioPath('bun-no-catalog')
    const catalog = new BunCatalog(createFixtureOptions('bun', {
      cwd: join(scenarioRoot, 'packages', 'app'),
    }))

    await catalog.ensureWorkspace()

    expect(normalize(await catalog.getWorkspacePath())).toBe(normalize(join(scenarioRoot, 'package.json')))
    await expect(catalog.toJSON()).resolves.toEqual({})
  })

  it('loads workspace catalog fields from bun fixture package.json', async () => {
    const catalog = new BunCatalog(createFixtureOptions('bun'))
    await catalog.ensureWorkspace()

    expect(normalize(await catalog.getWorkspacePath())).toBe(normalize(getFixturePath('bun', 'package.json')))
    await expect(catalog.toJSON()).resolves.toMatchObject({
      catalog: { 'solid-js': '^1.9.0' },
      catalogs: { test: { vitest: '^4.0.0' } },
    })
  })
})
