import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  WorkspacePackageMeta,
} from '../../src/types'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanCommand } from '../../src/commands/clean'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  ensureWorkspaceFile,
} from '../../src/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn(),
  log: {
    info: vi.fn(),
  },
}))

vi.mock('../../src/commands/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/commands/shared')>()
  return {
    ...actual,
    ensureWorkspaceFile: vi.fn(),
    confirmWorkspaceChanges: vi.fn(async (modifier: () => Promise<void>) => {
      await modifier()
      return 'applied' as const
    }),
  }
})

interface CleanWorkspaceLike {
  loadPackages: () => Promise<Array<PackageJsonMeta | WorkspacePackageMeta>>
  catalog: {
    findWorkspaceFile: () => Promise<string | undefined>
    removePackages: (deps: RawDep[]) => Promise<void>
  }
}

let workspaceInstance: CleanWorkspaceLike

vi.mock('../../src/workspace-manager', () => ({
  WorkspaceManager: class {
    constructor() {
      return workspaceInstance
    }
  },
}))

const ensureWorkspaceFileMock = vi.mocked(ensureWorkspaceFile)
const confirmWorkspaceChangesMock = vi.mocked(confirmWorkspaceChanges)
const outroMock = vi.mocked(p.outro)

function createProjectPackage(deps: RawDep[]): PackageJsonMeta {
  return {
    type: 'package.json',
    name: 'app',
    private: true,
    version: '1.0.0',
    filepath: '/repo/package.json',
    relative: 'package.json',
    raw: { name: 'app' },
    deps,
  }
}

function createWorkspacePackage(dep: RawDep): WorkspacePackageMeta {
  return {
    type: 'pnpm-workspace.yaml',
    name: 'pnpm-catalog:prod',
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
  packages: Array<PackageJsonMeta | WorkspacePackageMeta>,
  filepath: string | undefined,
): CleanWorkspaceLike {
  return {
    loadPackages: vi.fn(async () => packages),
    catalog: {
      findWorkspaceFile: vi.fn(async () => filepath),
      removePackages: vi.fn(async () => {}),
    },
  }
}

describe('cleanCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureWorkspaceFileMock.mockResolvedValue(undefined)
    workspaceInstance = createWorkspace([createProjectPackage([])], '/repo/pnpm-workspace.yaml')
  })

  it('throws when workspace file is missing', async () => {
    workspaceInstance = createWorkspace([createProjectPackage([])], undefined)
    await expect(cleanCommand(createFixtureOptions('pnpm'))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.NOT_FOUND,
    })
  })

  it('prints no-op message when no dependency can be cleaned', async () => {
    const usedDep: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    workspaceInstance = createWorkspace([
      createProjectPackage([usedDep]),
      createWorkspacePackage({
        ...usedDep,
        source: 'pnpm-workspace',
        specifier: '^18.3.1',
      }),
    ], '/repo/pnpm-workspace.yaml')

    await cleanCommand(createFixtureOptions('pnpm', { yes: true }))

    expect(ensureWorkspaceFileMock).toHaveBeenCalledTimes(1)
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('no dependencies to clean'))
    expect(confirmWorkspaceChangesMock).not.toHaveBeenCalled()
  })

  it('applies clean changes when orphan workspace deps exist', async () => {
    const orphanDep: RawDep = {
      name: 'unused',
      specifier: '^1.0.0',
      source: 'pnpm-workspace',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    workspaceInstance = createWorkspace([
      createProjectPackage([]),
      createWorkspacePackage(orphanDep),
    ], '/repo/pnpm-workspace.yaml')

    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })
    await cleanCommand(options)

    expect(confirmWorkspaceChangesMock).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.catalog.removePackages).toHaveBeenCalledWith([orphanDep])
  })
})
