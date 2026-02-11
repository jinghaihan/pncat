import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  WorkspacePackageMeta,
} from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveRemove } from '@/commands/remove'
import { COMMAND_ERROR_CODES, runAgentRemove } from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn(),
  isCancel: vi.fn(),
  log: {
    info: vi.fn(),
  },
}))

vi.mock('../../src/commands/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/commands/shared')>()
  return {
    ...actual,
    runAgentRemove: vi.fn(),
  }
})

const multiselectMock = vi.mocked(p.multiselect)
const isCancelMock = vi.mocked(p.isCancel)
const runAgentRemoveMock = vi.mocked(runAgentRemove)

function createProjectPackage(
  name: string,
  filepath: string,
  deps: RawDep[],
): PackageJsonMeta {
  return {
    type: 'package.json',
    name,
    private: true,
    version: '0.0.0',
    filepath,
    relative: filepath.replace('/repo/', ''),
    raw: {
      name,
      dependencies: Object.fromEntries(
        deps
          .filter(dep => dep.source === 'dependencies')
          .map(dep => [dep.name, dep.specifier]),
      ),
    },
    deps,
  }
}

function createWorkspacePackage(dep: RawDep): WorkspacePackageMeta {
  return {
    type: 'pnpm-workspace.yaml',
    name: `pnpm-catalog:${dep.catalogName}`,
    private: true,
    version: '',
    filepath: '/repo/pnpm-workspace.yaml',
    relative: 'pnpm-workspace.yaml',
    raw: {},
    context: {},
    deps: [dep],
  }
}

function createWorkspace(
  projectPackages: PackageJsonMeta[],
  workspacePackages: WorkspacePackageMeta[],
): WorkspaceManager {
  return {
    loadPackages: async () => [...projectPackages, ...workspacePackages],
    getProjectPackages: () => projectPackages,
    getWorkspacePackages: () => workspacePackages,
    getCwd: () => '/repo',
    removeCatalogDependencyFromPackages: (
      updatedPackages: Map<string, PackageJsonMeta>,
      packages: PackageJsonMeta[],
      depName: string,
      catalogName: string,
    ) => {
      let removed = false

      for (const pkg of packages) {
        for (const dep of pkg.deps) {
          if (dep.name !== depName)
            continue
          if (dep.specifier !== `catalog:${catalogName}` && dep.specifier !== (catalogName === 'default' ? 'catalog:' : `catalog:${catalogName}`))
            continue

          if (!updatedPackages.has(pkg.name))
            updatedPackages.set(pkg.name, structuredClone(pkg))

          const updated = updatedPackages.get(pkg.name)!
          if (dep.source === 'pnpm.overrides') {
            delete updated.raw.pnpm?.overrides?.[dep.name]
            removed = true
            continue
          }

          delete (updated.raw as Record<string, Record<string, string> | undefined>)[dep.source]?.[dep.name]
          removed = true
        }
      }

      return removed
    },
    isCatalogDependencyReferenced: (
      depName: string,
      catalogName: string,
      packages: PackageJsonMeta[] = projectPackages,
    ) => {
      const expected = catalogName === 'default' ? 'catalog:' : `catalog:${catalogName}`
      return packages.some(pkg =>
        pkg.deps.some(dep => dep.name === depName && dep.specifier === expected),
      )
    },
  } as unknown as WorkspaceManager
}

describe('resolveRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    multiselectMock.mockResolvedValue(['prod'])
    isCancelMock.mockReturnValue(false)
  })

  it('removes catalog dependency from target package and marks workspace entry for deletion', async () => {
    const depInPackage: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const depInWorkspace: RawDep = {
      ...depInPackage,
      specifier: '^18.3.1',
      source: 'pnpm-workspace',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createProjectPackage('app', '/repo/package.json', [depInPackage])],
      [createWorkspacePackage(depInWorkspace)],
    )
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })

    const result = await resolveRemove({
      args: ['react', '-r'],
      options,
      workspace,
    })
    const { updatedPackages = {} } = result

    expect(result.dependencies).toEqual([depInWorkspace])
    expect(updatedPackages.app.raw.dependencies).toEqual({})
    expect(runAgentRemoveMock).not.toHaveBeenCalled()
  })

  it('keeps workspace catalog entry when non-recursive remove has remaining references', async () => {
    const depInPackage: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const depInWorkspace: RawDep = {
      ...depInPackage,
      specifier: '^18.3.1',
      source: 'pnpm-workspace',
    }

    const workspace = createWorkspace(
      [
        createProjectPackage('app', '/repo/package.json', [depInPackage]),
        createProjectPackage('docs', '/repo/packages/docs/package.json', [depInPackage]),
      ],
      [createWorkspacePackage(depInWorkspace)],
    )
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })

    const result = await resolveRemove({
      args: ['react'],
      options,
      workspace,
    })
    const { updatedPackages = {} } = result

    expect(result.dependencies).toEqual([])
    expect(updatedPackages.app.raw.dependencies).toEqual({})
    expect(updatedPackages.docs).toBeUndefined()
  })

  it('delegates non-catalog dependency removal to package manager command', async () => {
    const depInPackage: RawDep = {
      name: 'lodash',
      specifier: '^4.17.21',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: false,
    }

    const workspace = createWorkspace(
      [createProjectPackage('app', '/repo/package.json', [depInPackage])],
      [],
    )
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })

    const result = await resolveRemove({
      args: ['lodash', '-r'],
      options,
      workspace,
    })

    expect(result.dependencies).toEqual([])
    expect(result.updatedPackages).toEqual({})
    expect(runAgentRemoveMock).toHaveBeenCalledWith(['lodash'], {
      cwd: '/repo',
      agent: 'pnpm',
      recursive: true,
    })
  })

  it('uses selected catalog when dependency exists in multiple catalogs', async () => {
    multiselectMock.mockResolvedValue(['legacy'])

    const depInPackage: RawDep = {
      name: 'react',
      specifier: 'catalog:legacy',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'legacy',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createProjectPackage('app', '/repo/package.json', [depInPackage])],
      [
        createWorkspacePackage({
          ...depInPackage,
          source: 'pnpm-workspace',
          specifier: '^17.0.0',
          catalogName: 'legacy',
        }),
        createWorkspacePackage({
          ...depInPackage,
          source: 'pnpm-workspace',
          specifier: '^18.3.1',
          catalogName: 'prod',
        }),
      ],
    )
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: false })

    const result = await resolveRemove({
      args: ['react', '-r'],
      options,
      workspace,
    })

    expect(multiselectMock).toHaveBeenCalledTimes(1)
    expect(result.dependencies).toEqual([
      expect.objectContaining({
        catalogName: 'legacy',
      }),
    ])
  })

  it('throws when catalog selection is canceled', async () => {
    multiselectMock.mockResolvedValue(['legacy'])
    isCancelMock.mockReturnValue(true)

    const depInPackage: RawDep = {
      name: 'react',
      specifier: 'catalog:legacy',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'legacy',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createProjectPackage('app', '/repo/package.json', [depInPackage])],
      [
        createWorkspacePackage({
          ...depInPackage,
          source: 'pnpm-workspace',
          specifier: '^17.0.0',
          catalogName: 'legacy',
        }),
        createWorkspacePackage({
          ...depInPackage,
          source: 'pnpm-workspace',
          specifier: '^18.3.1',
          catalogName: 'prod',
        }),
      ],
    )

    await expect(resolveRemove({
      args: ['react'],
      options: createFixtureOptions('pnpm', { yes: false }),
      workspace,
    })).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.ABORT })
  })
})
