import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  WorkspacePackageMeta,
} from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveClean } from '@/commands/clean'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  multiselect: vi.fn(),
  isCancel: vi.fn(),
}))

const multiselectMock = vi.mocked(p.multiselect)
const isCancelMock = vi.mocked(p.isCancel)

function createProjectPackage(deps: RawDep[]): PackageJsonMeta {
  return {
    type: 'package.json',
    name: 'app',
    private: true,
    version: '0.0.0',
    filepath: '/repo/package.json',
    relative: 'package.json',
    raw: {
      name: 'app',
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

function createWorkspacePackage(deps: RawDep[]): WorkspacePackageMeta {
  return {
    type: 'pnpm-workspace.yaml',
    name: 'pnpm-catalog:default',
    private: true,
    version: '',
    filepath: '/repo/pnpm-workspace.yaml',
    relative: 'pnpm-workspace.yaml',
    raw: {},
    context: {},
    deps,
  }
}

function createWorkspace(
  projectPackages: PackageJsonMeta[],
  workspacePackages: WorkspacePackageMeta[],
): WorkspaceManager {
  return {
    loadPackages: async () => [...projectPackages, ...workspacePackages],
    listProjectPackages: () => projectPackages,
    listWorkspacePackages: () => workspacePackages,
    listCatalogTargetPackages: () => [...projectPackages, ...workspacePackages],
    isCatalogDepReferenced: (
      depName: string,
      catalogName: string,
      packages: Array<{ deps: RawDep[] }> = projectPackages,
    ): boolean => {
      const expected = catalogName === 'default' ? 'catalog:' : `catalog:${catalogName}`

      return packages.some(pkg =>
        pkg.deps.some(dep =>
          dep.name === depName
          && (
            dep.specifier === expected
            || dep.specifier === `catalog:${catalogName}`
          ),
        ),
      )
    },
  } as unknown as WorkspaceManager
}

describe('resolveClean', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    multiselectMock.mockResolvedValue([0])
    isCancelMock.mockReturnValue(false)
  })

  it('collects workspace dependencies not referenced by any package catalog specifier', async () => {
    const workspaceDep: RawDep = {
      name: 'unused',
      specifier: '^1.0.0',
      source: 'pnpm-workspace',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createProjectPackage([])],
      [createWorkspacePackage([workspaceDep])],
    )
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })

    const result = await resolveClean({
      options,
      workspace,
    })

    expect(result.dependencies).toEqual([workspaceDep])
  })

  it('ignores workspace dependency when referenced by catalog: specifier in package.json', async () => {
    const workspaceDep: RawDep = {
      name: 'react',
      specifier: '^18.3.1',
      source: 'pnpm-workspace',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const pkgDep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createProjectPackage([pkgDep])],
      [createWorkspacePackage([workspaceDep])],
    )

    const result = await resolveClean({
      options: createFixtureOptions('pnpm', { yes: true }),
      workspace,
    })

    expect(result.dependencies).toEqual([])
  })

  it('ignores workspace dependency when referenced by workspace overrides entry', async () => {
    const workspaceDep: RawDep = {
      name: 'react',
      specifier: '^18.3.1',
      source: 'pnpm-workspace',
      parents: [],
      catalogable: true,
      catalogName: 'frontend',
      isCatalog: true,
    }
    const overrideDep: RawDep = {
      name: 'react',
      specifier: 'catalog:frontend',
      source: 'pnpm.overrides',
      parents: [],
      catalogable: true,
      catalogName: 'frontend',
      isCatalog: true,
    }
    const overridesWorkspacePackage: WorkspacePackageMeta = {
      ...createWorkspacePackage([overrideDep]),
      name: 'pnpm-workspace:overrides',
    }
    const workspace = createWorkspace(
      [createProjectPackage([])],
      [createWorkspacePackage([workspaceDep]), overridesWorkspacePackage],
    )

    const result = await resolveClean({
      options: createFixtureOptions('pnpm', { yes: true }),
      workspace,
    })

    expect(result.dependencies).toEqual([])
  })

  it('ignores workspace dependency when referenced by pnpm.overrides catalog specifier', async () => {
    const workspaceDep: RawDep = {
      name: 'eslint',
      specifier: '^9.0.0',
      source: 'pnpm-workspace',
      parents: [],
      catalogable: true,
      catalogName: 'dev',
      isCatalog: true,
    }
    const overrideDep: RawDep = {
      name: 'eslint',
      specifier: 'catalog:dev',
      source: 'pnpm.overrides',
      parents: [],
      catalogable: true,
      catalogName: 'dev',
      isCatalog: true,
    }
    const workspace = createWorkspace(
      [createProjectPackage([overrideDep])],
      [createWorkspacePackage([workspaceDep])],
    )

    const result = await resolveClean({
      options: createFixtureOptions('pnpm', { yes: true }),
      workspace,
    })

    expect(result.dependencies).toEqual([])
  })

  it('returns only selected dependencies when interactive selection is used', async () => {
    const workspace = createWorkspace(
      [createProjectPackage([])],
      [createWorkspacePackage([
        {
          name: 'a',
          specifier: '^1.0.0',
          source: 'pnpm-workspace',
          parents: [],
          catalogable: true,
          catalogName: 'prod',
          isCatalog: true,
        },
        {
          name: 'b',
          specifier: '^2.0.0',
          source: 'pnpm-workspace',
          parents: [],
          catalogable: true,
          catalogName: 'prod',
          isCatalog: true,
        },
      ])],
    )

    const result = await resolveClean({
      options: createFixtureOptions('pnpm', { yes: false }),
      workspace,
    })

    expect(multiselectMock).toHaveBeenCalledTimes(1)
    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: 'a',
      }),
    ])
  })

  it('throws when clean selection is canceled', async () => {
    multiselectMock.mockResolvedValue([0])
    isCancelMock.mockReturnValue(true)

    const workspace = createWorkspace(
      [createProjectPackage([])],
      [createWorkspacePackage([{
        name: 'a',
        specifier: '^1.0.0',
        source: 'pnpm-workspace',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: true,
      }])],
    )

    await expect(resolveClean({
      options: createFixtureOptions('pnpm', { yes: false }),
      workspace,
    })).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.ABORT })
  })
})
