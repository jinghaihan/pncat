import type { CatalogOptions, PackageJsonMeta } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_ERROR_CODES, confirmWorkspaceChanges, ensureWorkspaceFile, readWorkspacePackageJSON } from '@/commands/shared'
import { runAgentInstall, runHooks } from '@/commands/shared/process'
import { detectWorkspaceRoot, readJsonFile, writeJsonFile } from '@/io'
import { createFixtureOptions } from '../../_shared'

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  isCancel: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('../../../src/commands/shared/process', () => ({
  runAgentInstall: vi.fn(),
  runHooks: vi.fn(),
}))

vi.mock('../../../src/io', () => ({
  detectWorkspaceRoot: vi.fn(),
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
}))

const confirmMock = vi.mocked(p.confirm)
const isCancelMock = vi.mocked(p.isCancel)
const existsSyncMock = vi.mocked(existsSync)
const writeFileMock = vi.mocked(writeFile)
const writeJsonFileMock = vi.mocked(writeJsonFile)
const detectWorkspaceRootMock = vi.mocked(detectWorkspaceRoot)
const readJsonFileMock = vi.mocked(readJsonFile)
const runAgentInstallMock = vi.mocked(runAgentInstall)
const runHooksMock = vi.mocked(runHooks)

function toWorkspaceManager(value: unknown): WorkspaceManager {
  return value as WorkspaceManager
}

function createWorkspace(rawText: string, nextText: string, overrides: Partial<CatalogOptions> = {}): WorkspaceManager & { apply: () => void } {
  let content = rawText
  return {
    getOptions: () => createFixtureOptions('pnpm', { yes: true, ...overrides }),
    getCwd: () => '/repo',
    catalog: {
      toString: vi.fn(async () => content),
      updateWorkspaceOverrides: vi.fn(async () => {}),
      getWorkspacePath: vi.fn(async () => '/repo/pnpm-workspace.yaml'),
      writeWorkspace: vi.fn(async () => {}),
    },
    apply: () => {
      content = nextText
    },
  } as unknown as WorkspaceManager & { apply: () => void }
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
      raw: {
        name: 'app',
        dependencies: {
          react: 'catalog:prod',
        },
      },
      deps: [],
    },
  }
}

describe('confirmWorkspaceChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isCancelMock.mockReturnValue(false)
    confirmMock.mockResolvedValue(true)
    existsSyncMock.mockReturnValue(true)
    detectWorkspaceRootMock.mockResolvedValue('/repo')
    readJsonFileMock.mockResolvedValue({ name: 'app' })
    runAgentInstallMock.mockResolvedValue(undefined)
    runHooksMock.mockResolvedValue(undefined)
  })

  it('returns noop when workspace content has no changes', async () => {
    const workspace = createWorkspace('catalog: {}', 'catalog: {}')

    const result = await confirmWorkspaceChanges(
      async () => {},
      {
        workspace,
        bailout: true,
      },
    )

    expect(result).toBe('noop')
    expect(workspace.catalog.writeWorkspace).not.toHaveBeenCalled()
  })

  it('writes workspace and package json when confirmed', async () => {
    const workspace = createWorkspace('catalog: {}', 'catalog:\n  react: ^18.3.1')
    const updatedPackages = createUpdatedPackage()

    const result = await confirmWorkspaceChanges(
      async () => {
        workspace.apply()
      },
      {
        workspace,
        updatedPackages,
        yes: true,
        completeMessage: 'migrate complete',
      },
    )

    expect(result).toBe('applied')
    expect(writeJsonFileMock).toHaveBeenCalledWith('/repo/package.json', updatedPackages.app.raw)
    expect(workspace.catalog.writeWorkspace).toHaveBeenCalledTimes(1)
    expect(runAgentInstallMock).toHaveBeenCalledWith({
      cwd: '/repo',
      agent: 'pnpm',
    })
  })

  it('returns aborted when user rejects confirmation', async () => {
    const workspace = createWorkspace('catalog: {}', 'catalog:\n  react: ^18.3.1')
    confirmMock.mockResolvedValue(false)

    await expect(confirmWorkspaceChanges(
      async () => {
        workspace.apply()
      },
      {
        workspace,
        yes: false,
      },
    )).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.ABORT })
    expect(workspace.catalog.writeWorkspace).not.toHaveBeenCalled()
    expect(runAgentInstallMock).not.toHaveBeenCalled()
  })

  it('runs post hooks after workspace write', async () => {
    const workspace = createWorkspace(
      'catalog: {}',
      'catalog:\n  react: ^18.3.1',
      { postRun: 'eslint --fix "**/package.json"' },
    )

    await confirmWorkspaceChanges(
      async () => {
        workspace.apply()
      },
      {
        workspace,
        yes: true,
      },
    )

    expect(runHooksMock).toHaveBeenCalledWith('eslint --fix "**/package.json"', {
      cwd: '/repo',
    })
  })

  it('prints complete outro without install when install is disabled', async () => {
    const workspace = createWorkspace(
      'catalog: {}',
      'catalog:\n  react: ^18.3.1',
      { install: false },
    )

    await confirmWorkspaceChanges(
      async () => {
        workspace.apply()
      },
      {
        workspace,
        yes: true,
        completeMessage: 'migrate complete',
      },
    )

    expect(runAgentInstallMock).not.toHaveBeenCalled()
  })
})

describe('ensureWorkspaceFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isCancelMock.mockReturnValue(false)
    confirmMock.mockResolvedValue(true)
    detectWorkspaceRootMock.mockResolvedValue('/repo')
  })

  it('creates missing workspace file and ensures workspace', async () => {
    const ensureWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureOptions('pnpm', { yes: false }),
      getCwd: () => '/repo/packages/app',
      catalog: {
        findWorkspaceFile: vi.fn(async () => undefined),
        ensureWorkspace,
      },
    }

    await ensureWorkspaceFile(toWorkspaceManager(workspace))

    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('/repo'),
    }))
    expect(writeFileMock).toHaveBeenCalledWith('/repo/pnpm-workspace.yaml', 'packages: []', 'utf-8')
    expect(ensureWorkspace).toHaveBeenCalledTimes(1)
  })

  it('throws when user cancels workspace creation', async () => {
    confirmMock.mockResolvedValue(false)
    const ensureWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureOptions('pnpm', { yes: false }),
      getCwd: () => '/repo/packages/app',
      catalog: {
        findWorkspaceFile: vi.fn(async () => undefined),
        ensureWorkspace,
      },
    }

    await expect(ensureWorkspaceFile(toWorkspaceManager(workspace))).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.ABORT })
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(ensureWorkspace).not.toHaveBeenCalled()
  })

  it('skips prompt and creates workspace file when yes is enabled', async () => {
    const ensureWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureOptions('vlt', { yes: true }),
      getCwd: () => '/repo/packages/app',
      catalog: {
        findWorkspaceFile: vi.fn(async () => undefined),
        ensureWorkspace,
      },
    }

    await ensureWorkspaceFile(toWorkspaceManager(workspace))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith('/repo/vlt.json', '{}', 'utf-8')
    expect(ensureWorkspace).toHaveBeenCalledTimes(1)
  })

  it('delegates directly to catalog ensureWorkspace for bun', async () => {
    const ensureWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureOptions('bun', { yes: false }),
      getCwd: () => '/repo/packages/app',
      catalog: {
        findWorkspaceFile: vi.fn(async () => undefined),
        ensureWorkspace,
      },
    }

    await ensureWorkspaceFile(toWorkspaceManager(workspace))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(detectWorkspaceRootMock).not.toHaveBeenCalled()
    expect(ensureWorkspace).toHaveBeenCalledTimes(1)
  })
})

describe('readWorkspacePackageJSON', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existsSyncMock.mockReturnValue(true)
    readJsonFileMock.mockResolvedValue({ name: 'app' })
  })

  it('returns package.json path and parsed content when valid', async () => {
    const workspace = {
      getCwd: () => '/repo',
    }

    const result = await readWorkspacePackageJSON(toWorkspaceManager(workspace))

    expect(result.pkgPath).toBe('/repo/package.json')
    expect(result.pkgName).toBe('app')
    expect(result.pkgJson).toEqual({ name: 'app' })
  })

  it('throws when package.json does not exist', async () => {
    existsSyncMock.mockReturnValue(false)
    const workspace = {
      getCwd: () => '/repo',
    }

    await expect(readWorkspacePackageJSON(toWorkspaceManager(workspace))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.NOT_FOUND,
    })
  })

  it('throws when package.json does not contain name', async () => {
    readJsonFileMock.mockResolvedValue({})
    const workspace = {
      getCwd: () => '/repo',
    }

    await expect(readWorkspacePackageJSON(toWorkspaceManager(workspace))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })
})
