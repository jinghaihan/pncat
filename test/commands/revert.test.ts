import type {
  CatalogOptions,
  PackageJsonMeta,
  PackageMeta,
  RawDep,
  WorkspaceSchema,
} from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { describe, expect, it } from 'vitest'
import { resolveRevert } from '@/commands/revert'
import { createFixtureOptions } from '../_shared'

function createPackage(
  name: string,
  deps: RawDep[],
): PackageJsonMeta {
  return {
    type: 'package.json',
    name,
    private: true,
    version: '0.0.0',
    filepath: `/repo/${name === 'app' ? '' : `packages/${name}/`}package.json`.replace('//', '/'),
    relative: name === 'app' ? 'package.json' : `packages/${name}/package.json`,
    raw: {
      name,
      dependencies: Object.fromEntries(
        deps
          .filter(dep => dep.source === 'dependencies')
          .map(dep => [dep.name, dep.specifier]),
      ),
      pnpm: {
        overrides: Object.fromEntries(
          deps
            .filter(dep => dep.source === 'pnpm.overrides')
            .map(dep => [dep.name, dep.specifier]),
        ),
      },
    },
    deps,
  }
}

function createWorkspace(
  packages: PackageMeta[],
  catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
): WorkspaceManager {
  return {
    loadPackages: async () => packages,
    listCatalogTargetPackages: () => packages,
    listProjectPackages: () => packages.filter((pkg): pkg is PackageJsonMeta => pkg.type === 'package.json'),
    getCatalogIndex: async () => catalogIndex,
    setDepSpecifier: (
      updatedPackages: Map<string, PackageJsonMeta>,
      pkg: PackageJsonMeta,
      dep: RawDep,
      specifier: string,
    ) => {
      if (!updatedPackages.has(pkg.name))
        updatedPackages.set(pkg.name, structuredClone(pkg))

      const updated = updatedPackages.get(pkg.name)!
      if (dep.source === 'pnpm.overrides') {
        updated.raw.pnpm ??= {}
        updated.raw.pnpm.overrides ??= {}
        updated.raw.pnpm.overrides[dep.name] = specifier
        return
      }

      updated.raw[dep.source] ??= {}
      ;(updated.raw[dep.source] as Record<string, string>)[dep.name] = specifier
    },
    resolveCatalogDep: (
      dep: RawDep,
      index: Map<string, { catalogName: string, specifier: string }[]>,
    ) => {
      const entries = index.get(dep.name) || []
      const matched = entries.find((item: { catalogName: string, specifier: string }) => item.catalogName === dep.catalogName) || entries[0]
      return {
        ...dep,
        specifier: matched?.specifier || dep.specifier,
      }
    },
  } as unknown as WorkspaceManager
}

function createWorkspaceOverridesPackage(
  deps: RawDep[],
): PackageMeta {
  return {
    type: 'pnpm-workspace.yaml',
    name: 'pnpm-workspace:overrides',
    private: true,
    version: '',
    filepath: '/repo/pnpm-workspace.yaml',
    relative: 'pnpm-workspace.yaml',
    raw: {
      overrides: Object.fromEntries(
        deps.map(dep => [dep.name, dep.specifier]),
      ),
    } as WorkspaceSchema,
    context: {},
    deps,
  }
}

describe('resolveRevert', () => {
  it('reverts all catalog dependencies when no target deps are provided', async () => {
    const dep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createPackage('app', [dep])],
      new Map([['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]]]),
    )
    const options: CatalogOptions = createFixtureOptions('pnpm')

    const result = await resolveRevert({
      args: [],
      options,
      workspace,
    })
    const { updatedPackages = {} } = result

    expect(result.isRevertAll).toBe(true)
    expect(result.dependencies).toEqual([
      {
        ...dep,
        specifier: '^18.3.1',
      },
    ])
    expect(updatedPackages.app.raw.dependencies?.react).toBe('^18.3.1')
  })

  it('reverts only selected dependency names when args are provided', async () => {
    const reactDep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const viteDep: RawDep = {
      name: 'vite',
      specifier: 'catalog:dev',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'dev',
      isCatalog: true,
    }

    const workspace = createWorkspace(
      [createPackage('app', [reactDep, viteDep])],
      new Map([
        ['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]],
        ['vite', [{ catalogName: 'dev', specifier: '^6.0.0' }]],
      ]),
    )

    const result = await resolveRevert({
      args: ['react'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })
    const { updatedPackages = {} } = result

    expect(result.isRevertAll).toBe(false)
    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: 'react',
      }),
    ])
    expect(updatedPackages.app.raw.dependencies?.react).toBe('^18.3.1')
    expect(updatedPackages.app.raw.dependencies?.vite).toBe('catalog:dev')
  })

  it('updates pnpm overrides when reverting catalog override dependencies', async () => {
    const overrideDep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'pnpm.overrides',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }

    const workspace = createWorkspace(
      [createPackage('app', [overrideDep])],
      new Map([['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]]]),
    )

    const result = await resolveRevert({
      args: ['react'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })
    const { updatedPackages = {} } = result

    expect(updatedPackages.app.raw.pnpm?.overrides?.react).toBe('^18.3.1')
  })

  it('ignores non-catalog dependency specifiers', async () => {
    const dep: RawDep = {
      name: 'react',
      specifier: '^18.3.1',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }
    const workspace = createWorkspace(
      [createPackage('app', [dep])],
      new Map(),
    )

    const result = await resolveRevert({
      args: [],
      options: createFixtureOptions('pnpm'),
      workspace,
    })

    expect(result.dependencies).toEqual([])
    expect(result.updatedPackages).toEqual({})
  })

  it('collects pnpm overrides pseudo package when reverting workspace override dependencies', async () => {
    const dep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'pnpm-workspace',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }

    const workspace = createWorkspace(
      [createWorkspaceOverridesPackage([dep])],
      new Map([['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]]]),
    )

    const result = await resolveRevert({
      args: ['react'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })

    expect(result.dependencies).toEqual([
      {
        ...dep,
        specifier: '^18.3.1',
      },
    ])
    expect(result.updatedPackages).toEqual({})
  })
})
