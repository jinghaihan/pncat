import { describe, expect, it } from 'vitest'
import { WorkspaceManager } from '@/workspace-manager'
import { createFixtureOptions, getFixtureCwd } from './_shared'

describe('constructor', () => {
  it('creates catalog handler for the selected package manager', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    expect(manager.catalog.constructor.name).toBe('PnpmCatalog')
  })
})

describe('getOptions', () => {
  it('returns the original options', () => {
    const options = createFixtureOptions('pnpm', { yes: true })
    const manager = new WorkspaceManager(options)
    expect(manager.getOptions()).toBe(options)
  })
})

describe('getCwd', () => {
  it('returns normalized cwd from options', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    expect(manager.getCwd()).toBe(getFixtureCwd('pnpm'))
  })
})

describe('loadPackages', () => {
  it('loads packages from fixture workspace', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const packages = await manager.loadPackages()

    expect(packages.length).toBeGreaterThan(0)
    expect(manager.getPackages()).toEqual(packages)
  })

  it('reuses loaded result on repeated calls', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const first = await manager.loadPackages()
    const second = await manager.loadPackages()

    expect(second).toBe(first)
  })
})

describe('getProjectPackages', () => {
  it('returns only package.json packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    expect(manager.getProjectPackages().every(pkg => pkg.type === 'package.json')).toBe(true)
  })
})

describe('getWorkspacePackages', () => {
  it('returns only workspace packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    const workspacePackages = manager.getWorkspacePackages()
    expect(workspacePackages.length).toBeGreaterThan(0)
    expect(workspacePackages.every(pkg => pkg.name.includes('catalog') || pkg.name.includes('workspace'))).toBe(true)
  })
})

describe('getDepNames', () => {
  it('collects unique dependency names from project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    expect(manager.getDepNames()).toEqual(['react', 'vitest'])
  })
})

describe('hasEslint', () => {
  it('returns false when eslint is absent in project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()
    expect(manager.hasEslint()).toBe(false)
  })
})

describe('hasVSCodeEngine', () => {
  it('returns false when vscode engine is absent in project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()
    expect(manager.hasVSCodeEngine()).toBe(false)
  })
})

describe('getCatalogIndex', () => {
  it('creates dependency catalog index from workspace data', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.catalog.ensureWorkspace()

    const index = await manager.getCatalogIndex()
    expect(index.get('react')).toContainEqual({ catalogName: 'default', specifier: '^18.3.1' })
    expect(index.get('vitest')).toContainEqual({ catalogName: 'test', specifier: '^4.0.0' })
  })
})

describe('resolveCatalogDependency', () => {
  it('resolves catalog specifier from catalog index', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const resolved = manager.resolveCatalogDependency(
      {
        name: 'react',
        specifier: 'catalog:prod',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: true,
      },
      new Map([
        ['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]],
      ]),
      false,
    )

    expect(resolved.specifier).toBe('^18.3.1')
    expect(resolved.catalogName).toBe('prod')
    expect(resolved.update).toBe(false)
  })

  it('keeps original catalog name when force is enabled', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const resolved = manager.resolveCatalogDependency(
      {
        name: 'react',
        specifier: 'catalog:prod',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: true,
      },
      new Map([
        ['react', [{ catalogName: 'legacy', specifier: '^18.3.1' }]],
      ]),
      true,
    )

    expect(resolved.catalogName).toBe('prod')
  })
})

describe('reset', () => {
  it('clears loaded package cache and dependency index', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    manager.reset()

    expect(manager.getPackages()).toEqual([])
    expect(manager.getDepNames()).toEqual([])
  })
})
