import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  ResolverResult,
} from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectCommand } from '@/commands/detect'
import { resolveMigrate } from '@/commands/migrate'
import { ensureWorkspaceFile, renderChanges } from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  note: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
  },
}))

vi.mock('../../src/commands/migrate', () => ({
  resolveMigrate: vi.fn(),
}))

vi.mock('../../src/commands/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/commands/shared')>()
  return {
    ...actual,
    ensureWorkspaceFile: vi.fn(),
    renderChanges: vi.fn(),
  }
})

const resolveMigrateMock = vi.mocked(resolveMigrate)
const ensureWorkspaceFileMock = vi.mocked(ensureWorkspaceFile)
const renderChangesMock = vi.mocked(renderChanges)

let workspaceInstance: WorkspaceManager

vi.mock('../../src/workspace-manager', () => ({
  WorkspaceManager: class {
    constructor() {
      return workspaceInstance
    }
  },
}))

function createWorkspace(): WorkspaceManager {
  return {
    loadPackages: vi.fn(async () => []),
    catalog: {},
  } as unknown as WorkspaceManager
}

function createDep(update: boolean): RawDep {
  return {
    name: 'react',
    specifier: '^18.3.1',
    source: 'dependencies',
    parents: [],
    catalogable: true,
    catalogName: 'prod',
    isCatalog: false,
    update,
  }
}

function createUpdatedPackage(): Record<string, PackageJsonMeta> {
  return {
    app: {
      type: 'package.json',
      name: 'app',
      private: true,
      version: '0.0.0',
      filepath: '/repo/package.json',
      relative: 'package.json',
      raw: { name: 'app' },
      deps: [createDep(true)],
    },
  }
}

describe('detectCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceInstance = createWorkspace()
    ensureWorkspaceFileMock.mockResolvedValue(undefined)
    renderChangesMock.mockReturnValue('changes')
  })

  it('prints no-op message when no dependencies need migration', async () => {
    resolveMigrateMock.mockResolvedValue({
      dependencies: [createDep(false)],
      updatedPackages: createUpdatedPackage(),
    } satisfies ResolverResult)

    await detectCommand(createFixtureOptions('pnpm'))

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('no dependencies to migrate'))
    expect(p.note).not.toHaveBeenCalled()
  })

  it('prints detected changes and migration hint', async () => {
    const options: CatalogOptions = createFixtureOptions('pnpm', { force: true })
    resolveMigrateMock.mockResolvedValue({
      dependencies: [createDep(true)],
      updatedPackages: createUpdatedPackage(),
    } satisfies ResolverResult)

    await detectCommand(options)

    expect(p.log.info).toHaveBeenCalledTimes(1)
    expect(renderChangesMock).toHaveBeenCalledTimes(1)
    expect(p.note).toHaveBeenCalledWith(expect.stringContaining('pncat migrate'))
    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('detect complete'))
  })
})
