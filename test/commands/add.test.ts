import type { CatalogOptions, PackageJsonMeta } from '../../src/types'
import type { WorkspaceManager } from '../../src/workspace-manager'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAdd } from '../../src/commands/add'
import { COMMAND_ERROR_CODES } from '../../src/commands/shared'
import { getLatestVersion } from '../../src/utils'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}))

vi.mock('../../src/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils')>()
  return {
    ...actual,
    getLatestVersion: vi.fn(),
  }
})

const getLatestVersionMock = vi.mocked(getLatestVersion)

interface AddWorkspaceLike {
  loadPackages: () => Promise<PackageJsonMeta[]>
  getProjectPackages: () => PackageJsonMeta[]
  getCatalogIndex: () => Promise<Map<string, { catalogName: string, specifier: string }[]>>
}

function createPackage(name: string): PackageJsonMeta {
  return {
    type: 'package.json',
    name,
    private: true,
    version: '0.0.0',
    filepath: `/repo/packages/${name}/package.json`,
    relative: `packages/${name}/package.json`,
    raw: {
      name,
    },
    deps: [],
  }
}

function createWorkspace(
  packages: PackageJsonMeta[],
  catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
): AddWorkspaceLike {
  return {
    loadPackages: async () => packages,
    getProjectPackages: () => packages,
    getCatalogIndex: async () => catalogIndex,
  }
}

function toWorkspaceManager(workspace: AddWorkspaceLike): WorkspaceManager {
  return workspace as unknown as WorkspaceManager
}

describe('resolveAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLatestVersionMock.mockResolvedValue('1.2.3')
  })

  it('throws when no dependency names are provided', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map())
    const options = createFixtureOptions('pnpm')

    await expect(resolveAdd({
      args: [],
      options,
      workspace: toWorkspaceManager(workspace),
    })).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.INVALID_INPUT })
  })

  it('uses existing workspace catalog specifier when dependency exists', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map([
      ['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]],
    ]))
    const options = createFixtureOptions('pnpm')

    const result = await resolveAdd({
      args: ['react'],
      options,
      workspace: toWorkspaceManager(workspace),
    })

    expect(result.dependencies).toEqual([
      {
        name: 'react',
        specifier: '^18.3.1',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: false,
      },
    ])
    expect(getLatestVersionMock).not.toHaveBeenCalled()
  })

  it('assigns workspace protocol for local packages without explicit specifier', async () => {
    const workspace = createWorkspace([
      createPackage('app'),
      createPackage('shared'),
    ], new Map())
    const options = createFixtureOptions('pnpm')

    const result = await resolveAdd({
      args: ['shared'],
      options,
      workspace: toWorkspaceManager(workspace),
    })

    expect(result.dependencies?.[0]).toMatchObject({
      name: 'shared',
      specifier: 'workspace:*',
    })
  })

  it('resolves latest npm version when dependency is missing from workspace catalogs', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map())
    const options = createFixtureOptions('pnpm', { catalog: 'prod' })

    const result = await resolveAdd({
      args: ['vitest'],
      options,
      workspace: toWorkspaceManager(workspace),
    })

    expect(getLatestVersionMock).toHaveBeenCalledWith('vitest')
    expect(result.dependencies).toEqual([
      {
        name: 'vitest',
        specifier: '^1.2.3',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: false,
      },
    ])
  })

  it('respects save-dev and save-exact flags from command args', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map())
    const options: CatalogOptions = createFixtureOptions('pnpm')

    const result = await resolveAdd({
      args: ['vitest', '-D', '-E'],
      options,
      workspace: toWorkspaceManager(workspace),
    })

    expect(result.isDev).toBe(true)
    expect(result.dependencies?.[0]).toMatchObject({
      source: 'devDependencies',
      specifier: '1.2.3',
    })
  })
})
