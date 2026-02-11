import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  WorkspacePackageMeta,
} from '../../src/types'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeCommand } from '../../src/commands/remove'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  ensureWorkspaceFile,
  runAgentRemove,
} from '../../src/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    info: vi.fn(),
  },
}))

vi.mock('../../src/commands/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/commands/shared')>()
  return {
    ...actual,
    ensureWorkspaceFile: vi.fn(),
    runAgentRemove: vi.fn(async () => {}),
    confirmWorkspaceChanges: vi.fn(async (modifier: () => Promise<void>) => {
      await modifier()
      return 'applied' as const
    }),
  }
})

interface RemoveWorkspaceLike {
  loadPackages: () => Promise<Array<PackageJsonMeta | WorkspacePackageMeta>>
  getProjectPackages: () => PackageJsonMeta[]
  getWorkspacePackages: () => WorkspacePackageMeta[]
  getCwd: () => string
  catalog: {
    findWorkspaceFile: () => Promise<string | undefined>
    removePackages: (deps: RawDep[]) => Promise<void>
  }
}

let workspaceInstance: RemoveWorkspaceLike

vi.mock('../../src/workspace-manager', () => ({
  WorkspaceManager: class {
    constructor() {
      return workspaceInstance
    }
  },
}))

const ensureWorkspaceFileMock = vi.mocked(ensureWorkspaceFile)
const runAgentRemoveMock = vi.mocked(runAgentRemove)
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
  filepath: string | undefined,
): RemoveWorkspaceLike {
  return {
    loadPackages: vi.fn(async () => [...projectPackages, ...workspacePackages]),
    getProjectPackages: vi.fn(() => projectPackages),
    getWorkspacePackages: vi.fn(() => workspacePackages),
    getCwd: vi.fn(() => '/repo'),
    catalog: {
      findWorkspaceFile: vi.fn(async () => filepath),
      removePackages: vi.fn(async () => {}),
    },
  }
}

describe('removeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureWorkspaceFileMock.mockResolvedValue(undefined)
    process.argv = ['node', 'pncat', 'remove', 'react']
    workspaceInstance = createWorkspace([createProjectPackage([])], [], '/repo/pnpm-workspace.yaml')
  })

  it('throws when no dependencies are provided', async () => {
    process.argv = ['node', 'pncat', 'remove']
    await expect(removeCommand(createFixtureOptions('pnpm'))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })

  it('delegates to package manager remove when workspace file is missing', async () => {
    workspaceInstance = createWorkspace([createProjectPackage([])], [], undefined)
    process.argv = ['node', 'pncat', 'remove', 'react', '-r']
    const options: CatalogOptions = createFixtureOptions('pnpm')

    await removeCommand(options)

    expect(runAgentRemoveMock).toHaveBeenCalledWith(['react'], {
      cwd: '/repo',
      agent: options.agent,
      recursive: true,
    })
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('remove complete'))
    expect(confirmWorkspaceChangesMock).not.toHaveBeenCalled()
  })

  it('throws when workspace file is missing and only flags are provided', async () => {
    workspaceInstance = createWorkspace([createProjectPackage([])], [], undefined)
    process.argv = ['node', 'pncat', 'remove', '-r']

    await expect(removeCommand(createFixtureOptions('pnpm'))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })

  it('applies catalog changes when workspace file exists', async () => {
    const depInProject: RawDep = {
      name: 'react',
      specifier: 'catalog:prod',
      source: 'dependencies',
      parents: [],
      catalogable: true,
      catalogName: 'prod',
      isCatalog: true,
    }
    const depInWorkspace: RawDep = {
      ...depInProject,
      source: 'pnpm-workspace',
      specifier: '^18.3.1',
    }
    workspaceInstance = createWorkspace(
      [createProjectPackage([depInProject])],
      [createWorkspacePackage(depInWorkspace)],
      '/repo/pnpm-workspace.yaml',
    )
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })
    process.argv = ['node', 'pncat', 'remove', 'react', '-r']

    await removeCommand(options)

    expect(ensureWorkspaceFileMock).toHaveBeenCalledTimes(1)
    expect(confirmWorkspaceChangesMock).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.catalog.removePackages).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'react', source: 'pnpm-workspace' }),
    ])
  })
})
