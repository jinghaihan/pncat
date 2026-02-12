import type { CatalogOptions, PackageJsonMeta, RawDep, WorkspaceSchema } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveMigrate } from '@/commands/migrate'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: vi.fn(),
  outro: vi.fn(),
  log: {
    warn: vi.fn(),
  },
}))

const selectMock = vi.mocked(p.select)
const isCancelMock = vi.mocked(p.isCancel)

function createPackage(dep: RawDep, name: string = 'app'): PackageJsonMeta {
  return {
    type: 'package.json',
    name,
    private: true,
    version: '0.0.0',
    filepath: `/repo/packages/${name}/package.json`,
    relative: `packages/${name}/package.json`,
    raw: {
      name,
      dependencies: {
        [dep.name]: dep.specifier,
      },
    },
    deps: [dep],
  }
}

function createWorkspace(
  packages: PackageJsonMeta[],
  workspaceJson: WorkspaceSchema,
): WorkspaceManager {
  const index = new Map<string, { catalogName: string, specifier: string }[]>()
  if (workspaceJson.catalog) {
    for (const [name, specifier] of Object.entries(workspaceJson.catalog)) {
      index.set(name, [
        ...(index.get(name) || []),
        { catalogName: 'default', specifier },
      ])
    }
  }

  if (workspaceJson.catalogs) {
    for (const [catalogName, catalog] of Object.entries(workspaceJson.catalogs)) {
      if (!catalog)
        continue

      for (const [name, specifier] of Object.entries(catalog)) {
        index.set(name, [
          ...(index.get(name) || []),
          { catalogName, specifier },
        ])
      }
    }
  }

  return {
    loadPackages: async () => packages,
    getCatalogIndex: async () => index,
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
      catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
      force: boolean,
    ) => {
      const catalogDeps = catalogIndex.get(dep.name) || []

      if (dep.specifier.startsWith('catalog:')) {
        if (catalogDeps.length === 0)
          throw new Error(`Unable to resolve catalog specifier for ${dep.name}`)

        const requestedCatalogName = dep.specifier.slice('catalog:'.length) || 'default'
        const matched = catalogDeps.find((item: { catalogName: string, specifier: string }) => item.catalogName === requestedCatalogName) || catalogDeps[0]
        return {
          ...dep,
          specifier: matched.specifier,
          catalogName: force ? dep.catalogName : matched.catalogName,
          update: dep.specifier !== `catalog:${dep.catalogName === 'default' ? '' : dep.catalogName}`,
        }
      }

      if (!force && catalogDeps.length > 0) {
        const matched = catalogDeps.find((item: { catalogName: string, specifier: string }) => item.catalogName === dep.catalogName) || catalogDeps[0]
        return {
          ...dep,
          specifier: matched.specifier,
          catalogName: matched.catalogName,
          update: dep.specifier !== `catalog:${matched.catalogName === 'default' ? '' : matched.catalogName}`,
        }
      }

      return {
        ...dep,
        update: dep.specifier !== `catalog:${dep.catalogName === 'default' ? '' : dep.catalogName}`,
      }
    },
    catalog: {
      ensureWorkspace: async () => {},
      toJSON: async () => workspaceJson,
      generateCatalogs: async () => {},
      writeWorkspace: async () => {},
    },
  } as unknown as WorkspaceManager
}

describe('resolveMigrate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectMock.mockResolvedValue('^0.0.0')
    isCancelMock.mockReturnValue(false)
  })

  it('converts package dependencies to catalog specifiers', async () => {
    const dep: RawDep = {
      name: 'react',
      specifier: '^18.3.1',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }
    const workspace = createWorkspace([createPackage(dep)], {})
    const options: CatalogOptions = createFixtureOptions('pnpm')

    const result = await resolveMigrate({
      options,
      workspace,
    })

    expect(result.dependencies).toEqual([
      {
        ...dep,
        update: true,
      },
    ])
    expect(result.updatedPackages?.app.raw.dependencies?.react).toBe('catalog:prod')
  })

  it('resolves catalog specifier from existing workspace catalog', async () => {
    const dep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const workspace = createWorkspace([createPackage(dep)], {
      catalogs: {
        prod: {
          react: '^18.3.1',
        },
      },
    })
    const options: CatalogOptions = createFixtureOptions('pnpm')

    const result = await resolveMigrate({
      options,
      workspace,
    })

    expect(result.dependencies?.[0].specifier).toBe('^18.3.1')
    expect(result.updatedPackages).toEqual({})
  })

  it('preserves existing workspace catalogs when no package uses dependency', async () => {
    const workspace = createWorkspace([], {
      catalog: {
        vitest: '^4.0.0',
      },
    })
    const options: CatalogOptions = createFixtureOptions('pnpm')

    const result = await resolveMigrate({
      options,
      workspace,
    })

    expect(result.dependencies).toEqual([
      {
        name: 'vitest',
        specifier: '^4.0.0',
        source: 'pnpm-workspace',
        parents: [],
        catalogable: true,
        catalogName: 'default',
        isCatalog: true,
      },
    ])
  })

  it('throws when workspace has unresolved catalog specifier', async () => {
    const options = createFixtureOptions('pnpm')
    const dep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }

    const workspace = createWorkspace([createPackage(dep)], {})
    await expect(resolveMigrate({
      options,
      workspace,
    })).rejects.toThrowError('Unable to resolve catalog specifier for react')
  })

  it('prompts for conflict resolution when multiple specifiers exist', async () => {
    const depA: RawDep = {
      name: 'react',
      specifier: '^18.2.0',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }
    const depB: RawDep = {
      ...depA,
      specifier: '~18.3.0',
    }

    selectMock.mockResolvedValue('~18.3.0')

    const workspace = createWorkspace([
      createPackage(depA, 'app-a'),
      createPackage(depB, 'app-b'),
    ], {})
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: false })

    const result = await resolveMigrate({
      options,
      workspace,
    })

    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(result.dependencies).toEqual([
      {
        ...depB,
        update: true,
      },
    ])
  })

  it('throws when conflict selection is canceled', async () => {
    const depA: RawDep = {
      name: 'react',
      specifier: '^18.2.0',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }
    const depB: RawDep = {
      ...depA,
      specifier: '~18.3.0',
    }

    selectMock.mockResolvedValue('^18.2.0')
    isCancelMock.mockReturnValue(true)

    const workspace = createWorkspace([
      createPackage(depA, 'app-a'),
      createPackage(depB, 'app-b'),
    ], {})
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: false })

    await expect(resolveMigrate({
      options,
      workspace,
    })).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.ABORT })
  })

  it('ignores dependencies that are marked as not catalogable', async () => {
    const dep: RawDep = {
      name: 'left-pad',
      specifier: '^1.3.0',
      source: 'dependencies',
      parents: [],
      catalogable: false,
      catalogName: 'prod',
      isCatalog: false,
    }
    const workspace = createWorkspace([createPackage(dep)], {})
    const result = await resolveMigrate({
      options: createFixtureOptions('pnpm'),
      workspace,
    })

    expect(result.dependencies).toEqual([])
    expect(result.updatedPackages).toEqual({})
  })

  it('keeps stable order when specifiers normalize to the same version', async () => {
    const depA: RawDep = {
      name: 'react',
      specifier: '^18.3.1',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }
    const depB: RawDep = {
      ...depA,
      specifier: '~18.3.1',
    }

    selectMock.mockImplementationOnce(async (input) => {
      expect(input.options.map(item => item.value)).toEqual(['^18.3.1', '~18.3.1'])
      return '^18.3.1'
    })

    const workspace = createWorkspace([
      createPackage(depA, 'app-a'),
      createPackage(depB, 'app-b'),
    ], {})

    const result = await resolveMigrate({
      options: createFixtureOptions('pnpm', { yes: false }),
      workspace,
    })

    expect(result.dependencies).toEqual([
      {
        ...depA,
        update: true,
      },
    ])
  })

  it('falls back to locale sorting when specifier cannot be normalized', async () => {
    const depA: RawDep = {
      name: 'react',
      specifier: 'workspace:*',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }
    const depB: RawDep = {
      ...depA,
      specifier: '^18.3.1',
    }

    selectMock.mockImplementationOnce(async (input) => {
      expect(input.options.map(item => item.value)).toEqual(['^18.3.1', 'workspace:*'])
      return '^18.3.1'
    })

    const workspace = createWorkspace([
      createPackage(depA, 'app-a'),
      createPackage(depB, 'app-b'),
    ], {})

    const result = await resolveMigrate({
      options: createFixtureOptions('pnpm', { yes: false }),
      workspace,
    })

    expect(result.dependencies).toEqual([
      {
        ...depB,
        update: true,
      },
    ])
  })
})
