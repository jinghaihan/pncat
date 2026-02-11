import type { PnpmWorkspaceMeta, RawDep, WorkspaceSchema } from '@/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PnpmCatalog } from '@/catalog-handler/pnpm-workspace'
import { loadPackages } from '@/io'
import { createFixtureOptions } from '../_shared'

vi.mock('../../src/io', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/io')>()
  return {
    ...actual,
    loadPackages: vi.fn(),
  }
})

const loadPackagesMock = vi.mocked(loadPackages)

function createRawDep(name: string, specifier: string): RawDep {
  return {
    name,
    specifier,
    source: 'dependencies',
    parents: [],
    catalogable: true,
    catalogName: 'default',
    isCatalog: false,
  }
}

function createWorkspaceMeta(
  name: string,
  raw: WorkspaceSchema,
  deps: RawDep[] = [],
): PnpmWorkspaceMeta {
  return {
    type: 'pnpm-workspace.yaml',
    name,
    private: true,
    version: '',
    filepath: '/repo/pnpm-workspace.yaml',
    relative: 'pnpm-workspace.yaml',
    raw,
    context: {},
    deps,
  }
}

describe('loadWorkspace', () => {
  it('returns null when relative path is not pnpm workspace file', async () => {
    const workspace = await PnpmCatalog.loadWorkspace(
      'package.json',
      createFixtureOptions(),
      () => true,
    )
    expect(workspace).toBeNull()
  })

  it('loads pnpm workspace entries from fixture', async () => {
    const workspace = await PnpmCatalog.loadWorkspace(
      'pnpm-workspace.yaml',
      createFixtureOptions(),
      () => true,
    )
    expect(workspace?.map(item => item.name)).toEqual([
      'pnpm-catalog:default',
      'pnpm-catalog:test',
      'pnpm-workspace:overrides',
    ])
  })
})

describe('updateWorkspaceOverrides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns early when overrides package is missing', async () => {
    const catalog = new PnpmCatalog(createFixtureOptions())
    await catalog.ensureWorkspace()

    loadPackagesMock.mockResolvedValue([
      createWorkspaceMeta('pnpm-catalog:default', {
        catalog: { react: '^18.3.1' },
      }),
    ])

    await catalog.updateWorkspaceOverrides()
    await expect(catalog.toJSON()).resolves.toMatchObject({
      overrides: {
        react: 'catalog:',
      },
    })
  })

  it('updates overrides via direct matches, catalog matches, and raw fallback', async () => {
    const catalog = new PnpmCatalog(createFixtureOptions())
    await catalog.ensureWorkspace()
    await catalog.setPackage('test', 'vue', '^3.5.0')
    await catalog.setPackage('modern', 'svelte', '~5.0.0')

    loadPackagesMock.mockResolvedValue([
      createWorkspaceMeta(
        'pnpm-catalog:default',
        {
          catalog: { react: '^18.3.1' },
          catalogs: {
            legacy: {
              svelte: '~5.0.0',
              solid: '~1.0.0',
            },
          },
        },
      ),
      createWorkspaceMeta(
        'pnpm-workspace:overrides',
        {},
        [
          createRawDep('react', '^18.3.1'),
          createRawDep('vue', 'catalog:test'),
          createRawDep('svelte', 'catalog:legacy'),
          createRawDep('solid', 'catalog:legacy'),
        ],
      ),
    ])

    await catalog.updateWorkspaceOverrides()
    await expect(catalog.toJSON()).resolves.toMatchObject({
      overrides: {
        react: 'catalog:default',
        vue: 'catalog:test',
        svelte: 'catalog:modern',
        solid: '~1.0.0',
      },
    })
  })
})
