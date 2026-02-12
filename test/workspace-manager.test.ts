import type { PackageJsonMeta, RawDep } from '@/types'
import { describe, expect, it } from 'vitest'
import { WorkspaceManager } from '@/workspace-manager'
import { createFixtureOptions, getFixtureCwd, getFixturePath } from './_shared'

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

describe('listProjectPackages', () => {
  it('returns only package.json packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    expect(manager.listProjectPackages().every(pkg => pkg.type === 'package.json')).toBe(true)
  })
})

describe('listWorkspacePackages', () => {
  it('returns only workspace packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    const workspacePackages = manager.listWorkspacePackages()
    expect(workspacePackages.length).toBeGreaterThan(0)
    expect(workspacePackages.every(pkg => pkg.name.includes('catalog') || pkg.name.includes('workspace'))).toBe(true)
  })
})

describe('listCatalogTargetPackages', () => {
  it('returns project packages and pnpm overrides pseudo package', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    const targets = manager.listCatalogTargetPackages()
    expect(targets.some(pkg => pkg.type === 'package.json')).toBe(true)
    expect(targets.some(pkg => pkg.name === 'pnpm-workspace:overrides')).toBe(true)
  })
})

describe('getDepNames', () => {
  it('collects unique dependency names from project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    expect(manager.getDepNames()).toEqual(['react', 'vitest'])
  })
})

describe('resolveTargetProjectPackagePath', () => {
  it('returns invocation package path when it belongs to project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    const invocationCwd = getFixturePath('pnpm', 'packages', 'app')
    const targetPath = manager.resolveTargetProjectPackagePath(invocationCwd)

    expect(targetPath).toBe(getFixturePath('pnpm', 'packages', 'app', 'package.json'))
  })

  it('falls back to workspace root package path when invocation package is outside workspace packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    await manager.loadPackages()

    const targetPath = manager.resolveTargetProjectPackagePath('/tmp')

    expect(targetPath).toBe(getFixturePath('pnpm', 'package.json'))
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

describe('resolveCatalogDep', () => {
  it('resolves catalog specifier from catalog index', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const resolved = manager.resolveCatalogDep(
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
    const resolved = manager.resolveCatalogDep(
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

  it('throws when catalog specifier cannot be resolved from index', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))

    expect(() => manager.resolveCatalogDep(
      {
        name: 'react',
        specifier: 'catalog:prod',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: true,
      },
      new Map(),
      false,
    )).toThrowError('Unable to resolve catalog specifier for react')
  })

  it('reuses indexed entry for non-catalog specifier when force is disabled', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const resolved = manager.resolveCatalogDep(
      {
        name: 'react',
        specifier: '^18.3.1',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: false,
      },
      new Map([
        ['react', [{ catalogName: 'legacy', specifier: '^17.0.0' }]],
      ]),
      false,
    )

    expect(resolved.catalogName).toBe('legacy')
    expect(resolved.specifier).toBe('^17.0.0')
    expect(resolved.update).toBe(true)
  })
})

describe('isCatalogDepReferenced', () => {
  it('returns true when pnpm overrides references expected catalog specifier', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'pnpm.overrides',
        specifier: 'catalog:prod',
      }),
    ], {
      pnpm: {
        overrides: {
          react: 'catalog:prod',
        },
      },
    })

    expect(manager.isCatalogDepReferenced('react', 'prod', [pkg])).toBe(true)
  })

  it('returns false when dependency is not a catalog specifier', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'dependencies',
        specifier: '^18.3.1',
      }),
    ], {
      dependencies: {
        react: '^18.3.1',
      },
    })

    expect(manager.isCatalogDepReferenced('react', 'prod', [pkg])).toBe(false)
  })

  it('returns true when package dependency references the target catalog', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'dependencies',
        specifier: 'catalog:prod',
      }),
    ], {
      dependencies: {
        react: 'catalog:prod',
      },
    })

    expect(manager.isCatalogDepReferenced('react', 'prod', [pkg])).toBe(true)
  })

  it('continues scanning when pnpm overrides entry points to a different catalog', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'pnpm.overrides',
        specifier: 'catalog:dev',
        catalogName: 'dev',
      }),
    ], {
      pnpm: {
        overrides: {
          react: 'catalog:dev',
        },
      },
    })

    expect(manager.isCatalogDepReferenced('react', 'prod', [pkg])).toBe(false)
  })

  it('ignores dependencies with different names while scanning package references', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'vite',
        source: 'dependencies',
        specifier: 'catalog:prod',
      }),
    ], {
      dependencies: {
        vite: 'catalog:prod',
      },
    })

    expect(manager.isCatalogDepReferenced('react', 'prod', [pkg])).toBe(false)
  })
})

describe('setDepSpecifier', () => {
  it('writes specifier into pnpm overrides source', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'pnpm.overrides',
        specifier: 'catalog:prod',
      }),
    ], {})

    const updatedPackages = new Map<string, PackageJsonMeta>()
    manager.setDepSpecifier(
      updatedPackages,
      pkg,
      pkg.deps[0],
      'catalog:test',
    )

    const updated = updatedPackages.get('app')
    expect(updated?.raw.pnpm?.overrides?.react).toBe('catalog:test')
  })

  it('skips non package.json dependency sources', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'pnpm-workspace',
        specifier: 'catalog:prod',
      }),
    ], {})

    const updatedPackages = new Map<string, PackageJsonMeta>()
    manager.setDepSpecifier(
      updatedPackages,
      pkg,
      pkg.deps[0],
      'catalog:test',
    )

    const updated = updatedPackages.get('app')
    expect(updated).toBeDefined()
    expect(updated?.raw.dependencies).toBeUndefined()
    expect(updated?.raw.devDependencies).toBeUndefined()
  })
})

describe('removeCatalogDepFromPackages', () => {
  it('removes dependency from pnpm overrides source', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'pnpm.overrides',
        specifier: 'catalog:prod',
      }),
    ], {
      pnpm: {
        overrides: {
          react: 'catalog:prod',
        },
      },
    })

    const updatedPackages = new Map<string, PackageJsonMeta>()
    const removed = manager.removeCatalogDepFromPackages(
      updatedPackages,
      [pkg],
      'react',
      'prod',
    )

    expect(removed).toBe(true)
    expect(updatedPackages.get('app')?.raw.pnpm?.overrides?.react).toBeUndefined()
  })

  it('removes dependency from package.json dependency fields', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'dependencies',
        specifier: 'catalog:prod',
      }),
    ], {
      dependencies: {
        react: 'catalog:prod',
      },
    })

    const updatedPackages = new Map<string, PackageJsonMeta>()
    const removed = manager.removeCatalogDepFromPackages(
      updatedPackages,
      [pkg],
      'react',
      'prod',
    )

    expect(removed).toBe(true)
    expect(updatedPackages.get('app')?.raw.dependencies?.react).toBeUndefined()
  })

  it('skips package deps under pnpm overrides pseudo package', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('pnpm-workspace:overrides', [
      createRawDep({
        name: 'react',
        source: 'dependencies',
        specifier: 'catalog:prod',
      }),
    ], {
      dependencies: {
        react: 'catalog:prod',
      },
    })

    const updatedPackages = new Map<string, PackageJsonMeta>()
    const removed = manager.removeCatalogDepFromPackages(
      updatedPackages,
      [pkg],
      'react',
      'prod',
    )

    expect(removed).toBe(false)
    expect(updatedPackages.get('pnpm-workspace:overrides')?.raw.dependencies?.react).toBe('catalog:prod')
  })

  it('skips non package.json dependency sources', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'pnpm-workspace',
        specifier: 'catalog:prod',
      }),
    ], {})

    const updatedPackages = new Map<string, PackageJsonMeta>()
    const removed = manager.removeCatalogDepFromPackages(
      updatedPackages,
      [pkg],
      'react',
      'prod',
    )

    expect(removed).toBe(false)
  })

  it('ignores dependencies that do not match target catalog specifier', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'dependencies',
        specifier: '^18.3.1',
        isCatalog: false,
      }),
      createRawDep({
        name: 'vite',
        source: 'dependencies',
        specifier: 'catalog:dev',
        catalogName: 'dev',
      }),
    ], {
      dependencies: {
        react: '^18.3.1',
        vite: 'catalog:dev',
      },
    })

    const updatedPackages = new Map<string, PackageJsonMeta>()
    const removed = manager.removeCatalogDepFromPackages(
      updatedPackages,
      [pkg],
      'react',
      'prod',
    )

    expect(removed).toBe(false)
    expect(updatedPackages.size).toBe(0)
  })

  it('ignores dependencies when catalog specifier points to a different catalog name', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))
    const pkg = createPackageJsonMeta('app', [
      createRawDep({
        name: 'react',
        source: 'dependencies',
        specifier: 'catalog:dev',
        catalogName: 'dev',
      }),
    ], {
      dependencies: {
        react: 'catalog:dev',
      },
    })

    const updatedPackages = new Map<string, PackageJsonMeta>()
    const removed = manager.removeCatalogDepFromPackages(
      updatedPackages,
      [pkg],
      'react',
      'prod',
    )

    expect(removed).toBe(false)
    expect(updatedPackages.size).toBe(0)
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

function createRawDep(overrides: Partial<RawDep>): RawDep {
  return {
    name: 'react',
    specifier: 'catalog:prod',
    source: 'dependencies',
    parents: [],
    catalogable: true,
    catalogName: 'prod',
    isCatalog: true,
    ...overrides,
  }
}

function createPackageJsonMeta(
  name: string,
  deps: RawDep[],
  raw: Record<string, unknown>,
): PackageJsonMeta {
  return {
    type: 'package.json',
    name,
    private: true,
    version: '0.0.0',
    filepath: `/tmp/${name}/package.json`,
    relative: 'package.json',
    deps,
    raw: {
      name,
      version: '0.0.0',
      private: true,
      ...raw,
    },
  }
}
