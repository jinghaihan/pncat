import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  ResolverResult,
} from '../../src/types'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectCommand } from '../../src/commands/detect'
import { resolveMigrate } from '../../src/commands/migrate'
import { ensureWorkspaceFile, renderChanges } from '../../src/commands/shared'
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
  const actual = await importOriginal<typeof import('../../src/commands/shared')>()
  return {
    ...actual,
    ensureWorkspaceFile: vi.fn(),
    renderChanges: vi.fn(),
  }
})

const resolveMigrateMock = vi.mocked(resolveMigrate)
const ensureWorkspaceFileMock = vi.mocked(ensureWorkspaceFile)
const renderChangesMock = vi.mocked(renderChanges)

interface DetectWorkspaceLike {
  loadPackages: () => Promise<unknown[]>
  catalog: Record<string, unknown>
}

let workspaceInstance: DetectWorkspaceLike

vi.mock('../../src/workspace-manager', () => ({
  WorkspaceManager: class {
    constructor() {
      return workspaceInstance
    }
  },
}))

function createWorkspace() {
  return {
    loadPackages: vi.fn(async () => []),
    catalog: {},
  }
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
