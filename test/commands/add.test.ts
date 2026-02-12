import type { CatalogOptions, PackageJsonMeta } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAdd } from '@/commands/add'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import * as utils from '@/utils'
import { createFixtureOptions } from '../_shared'

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils')
  return {
    ...actual,
    getLatestVersion: vi.fn(),
  }
})

const getLatestVersionMock = vi.mocked(utils.getLatestVersion)

function createPackage(name: string): PackageJsonMeta {
  return {
    type: 'package.json',
    name,
    private: true,
    version: '0.0.0',
    filepath: `/repo/packages/${name}/package.json`,
    relative: `packages/${name}/package.json`,
    raw: { name },
    deps: [],
  }
}

function createWorkspace(
  packages: PackageJsonMeta[],
  catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
): WorkspaceManager {
  return {
    loadPackages: async () => packages,
    listProjectPackages: () => packages,
    getCatalogIndex: async () => catalogIndex,
  } as unknown as WorkspaceManager
}

describe('resolveAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLatestVersionMock.mockResolvedValue('0.0.0')
  })

  it('throws when no dependency names are provided', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map())

    await expect(resolveAdd({
      args: [],
      options: createFixtureOptions('pnpm'),
      workspace,
    })).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.INVALID_INPUT })
  })

  it('uses existing workspace catalog specifier when dependency exists', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map([
      ['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]],
    ]))

    const result = await resolveAdd({
      args: ['react'],
      options: createFixtureOptions('pnpm'),
      workspace,
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
  })

  it('assigns workspace protocol for local packages without explicit specifier', async () => {
    const workspace = createWorkspace([
      createPackage('app'),
      createPackage('shared'),
    ], new Map())

    const result = await resolveAdd({
      args: ['shared'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })

    expect(result.dependencies?.[0]).toMatchObject({
      name: 'shared',
      specifier: 'workspace:*',
    })
  })

  it('uses provided specifier and catalog option without resolving from npm', async () => {
    const workspace = createWorkspace([createPackage('app')], new Map())
    const options = createFixtureOptions('pnpm', { catalog: 'prod' })

    const result = await resolveAdd({
      args: ['vitest@^4.0.0'],
      options,
      workspace,
    })

    expect(result.dependencies).toEqual([
      {
        name: 'vitest',
        specifier: '^4.0.0',
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
      args: ['vitest@1.2.3', '-D', '-E'],
      options,
      workspace,
    })

    expect(result.isDev).toBe(true)
    expect(result.dependencies?.[0]).toMatchObject({
      source: 'devDependencies',
      specifier: '1.2.3',
    })
  })

  it('resolves dependency version from npm when specifier is missing', async () => {
    getLatestVersionMock.mockResolvedValue('4.17.21')
    const workspace = createWorkspace([createPackage('app')], new Map())

    const result = await resolveAdd({
      args: ['lodash'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })

    expect(getLatestVersionMock).toHaveBeenCalledWith('lodash')
    expect(result.dependencies).toEqual([
      {
        name: 'lodash',
        specifier: '^4.17.21',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: false,
      },
    ])
  })

  it('uses exact npm version when save-exact is enabled', async () => {
    getLatestVersionMock.mockResolvedValue('4.17.21')
    const workspace = createWorkspace([createPackage('app')], new Map())

    const result = await resolveAdd({
      args: ['lodash', '-E'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })

    expect(result.dependencies?.[0]).toMatchObject({
      specifier: '4.17.21',
    })
  })

  it('throws when npm version lookup fails', async () => {
    getLatestVersionMock.mockResolvedValue('')
    const workspace = createWorkspace([createPackage('app')], new Map())

    await expect(resolveAdd({
      args: ['unknown-dep'],
      options: createFixtureOptions('pnpm'),
      workspace,
    })).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.INVALID_INPUT })
  })
})
