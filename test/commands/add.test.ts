import type { CatalogOptions, PackageJsonMeta } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { describe, expect, it } from 'vitest'
import { resolveAdd } from '@/commands/add'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

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
    getProjectPackages: () => packages,
    getCatalogIndex: async () => catalogIndex,
  } as unknown as WorkspaceManager
}

describe('resolveAdd', () => {
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
})
