import type { CatalogOptions, PackageJsonMeta, RawDep } from '../../src/types'
import type { WorkspaceManager } from '../../src/workspace-manager'
import { describe, expect, it } from 'vitest'
import { resolveRevert } from '../../src/commands/revert'
import { createFixtureOptions } from '../_shared'

interface RevertWorkspaceLike {
  loadPackages: () => Promise<PackageJsonMeta[]>
  getProjectPackages: () => PackageJsonMeta[]
  getCatalogIndex: () => Promise<Map<string, { catalogName: string, specifier: string }[]>>
  resolveCatalogDependency: (
    dep: RawDep,
    catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
    force: boolean,
  ) => RawDep
}

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
  packages: PackageJsonMeta[],
  catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
): RevertWorkspaceLike {
  return {
    loadPackages: async () => packages,
    getProjectPackages: () => packages,
    getCatalogIndex: async () => catalogIndex,
    resolveCatalogDependency: (dep, index) => {
      const entries = index.get(dep.name) || []
      const matched = entries.find(item => item.catalogName === dep.catalogName) || entries[0]
      return {
        ...dep,
        specifier: matched?.specifier || dep.specifier,
      }
    },
  }
}

function toWorkspaceManager(workspace: RevertWorkspaceLike): WorkspaceManager {
  return workspace as unknown as WorkspaceManager
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
      workspace: toWorkspaceManager(workspace),
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
      workspace: toWorkspaceManager(workspace),
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
      workspace: toWorkspaceManager(workspace),
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
      workspace: toWorkspaceManager(workspace),
    })

    expect(result.dependencies).toEqual([])
    expect(result.updatedPackages).toEqual({})
  })
})
