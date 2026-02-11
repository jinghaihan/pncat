import type { CatalogOptions, PackageJsonMeta, RawDep } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revertCommand } from '@/commands/revert'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  ensureWorkspaceFile,
} from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(),
}))

vi.mock('../../src/commands/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/commands/shared')>()
  return {
    ...actual,
    ensureWorkspaceFile: vi.fn(),
    confirmWorkspaceChanges: vi.fn(async (modifier: () => Promise<void>) => {
      await modifier()
      return 'applied' as const
    }),
  }
})

let workspaceInstance: WorkspaceManager

vi.mock('../../src/workspace-manager', () => ({
  WorkspaceManager: class {
    constructor() {
      return workspaceInstance
    }
  },
}))

const confirmMock = vi.mocked(p.confirm)
const isCancelMock = vi.mocked(p.isCancel)
const ensureWorkspaceFileMock = vi.mocked(ensureWorkspaceFile)
const confirmWorkspaceChangesMock = vi.mocked(confirmWorkspaceChanges)

function createPackage(deps: RawDep[]): PackageJsonMeta {
  return {
    type: 'package.json',
    name: 'app',
    private: true,
    version: '1.0.0',
    filepath: '/repo/package.json',
    relative: 'package.json',
    raw: {
      name: 'app',
      dependencies: Object.fromEntries(
        deps
          .filter(dep => dep.source === 'dependencies')
          .map(dep => [dep.name, dep.specifier]),
      ),
    },
    deps,
  }
}

function createWorkspace(
  packages: PackageJsonMeta[],
  catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
  filepath: string | undefined,
): WorkspaceManager {
  return {
    loadPackages: vi.fn(async () => packages),
    getProjectPackages: vi.fn(() => packages),
    getCatalogIndex: vi.fn(async () => catalogIndex),
    setDependencySpecifier: vi.fn((updatedPackages, pkg, dep, specifier) => {
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
    }),
    resolveCatalogDependency: vi.fn((dep, index) => {
      const matched = (index.get(dep.name) || [])[0]
      return {
        ...dep,
        specifier: matched?.specifier || dep.specifier,
      }
    }),
    catalog: {
      findWorkspaceFile: vi.fn(async () => filepath),
      clearCatalogs: vi.fn(async () => {}),
      removePackages: vi.fn(async () => {}),
    },
  } as unknown as WorkspaceManager
}

describe('revertCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirmMock.mockResolvedValue(true)
    isCancelMock.mockReturnValue(false)
    ensureWorkspaceFileMock.mockResolvedValue(undefined)
    process.argv = ['node', 'pncat', 'revert']
    workspaceInstance = createWorkspace([], new Map(), '/repo/pnpm-workspace.yaml')
  })

  it('throws when workspace file is missing', async () => {
    workspaceInstance = createWorkspace([], new Map(), undefined)
    await expect(revertCommand(createFixtureOptions('pnpm'))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.NOT_FOUND,
    })
  })

  it('throws abort when revert-all confirmation is declined', async () => {
    confirmMock.mockResolvedValue(false)
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: false })
    process.argv = ['node', 'pncat', 'revert']

    await expect(revertCommand(options)).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.ABORT,
    })
  })

  it('clears all catalogs when reverting all dependencies', async () => {
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })
    process.argv = ['node', 'pncat', 'revert']

    await revertCommand(options)

    expect(confirmWorkspaceChangesMock).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.catalog.clearCatalogs).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.catalog.removePackages).not.toHaveBeenCalled()
  })

  it('removes selected catalog dependencies when target deps are provided', async () => {
    const dep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    workspaceInstance = createWorkspace(
      [createPackage([dep])],
      new Map([['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]]]),
      '/repo/pnpm-workspace.yaml',
    )
    process.argv = ['node', 'pncat', 'revert', 'react']

    await revertCommand(createFixtureOptions('pnpm', { yes: true }))

    expect(confirmWorkspaceChangesMock).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.catalog.removePackages).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'react', specifier: '^18.3.1' }),
    ])
  })
})
