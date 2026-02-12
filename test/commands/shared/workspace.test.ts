import type { PackageJsonMeta } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { readFile, rm, writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { join } from 'pathe'
import { x } from 'tinyexec'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_ERROR_CODES, confirmWorkspaceChanges, ensureWorkspaceFile, readWorkspacePackageJSON } from '@/commands/shared'
import * as io from '@/io'
import { createFixtureOptions, createFixtureScenarioOptions, getFixtureScenarioPath } from '../../_shared'

vi.mock('tinyexec', () => ({
  x: vi.fn(),
}))

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts')
  return {
    ...actual,
    confirm: vi.fn(),
    isCancel: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    log: {
      ...actual.log,
      info: vi.fn(),
      warn: vi.fn(),
    },
  }
})

const confirmMock = vi.mocked(p.confirm)
const isCancelMock = vi.mocked(p.isCancel)
const noteMock = vi.mocked(p.note)
const logInfoMock = vi.mocked(p.log.info)
const xMock = vi.mocked(x)

const SCENARIO = 'command-shared'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const APP_PACKAGE_JSON_PATH = join(ROOT, 'packages/app/package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-shared",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
`

const WORKSPACE_BASELINE = `packages:
  - packages/*
catalog:
  react: ^18.3.1
`

beforeEach(async () => {
  vi.clearAllMocks()
  confirmMock.mockResolvedValue(true)
  isCancelMock.mockReturnValue(false)
  xMock.mockResolvedValue({} as never)

  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await rm(join(ROOT, 'vlt.json'), { force: true })
})

function toWorkspace(value: unknown): WorkspaceManager {
  return value as WorkspaceManager
}

describe('confirmWorkspaceChanges', () => {
  it('returns noop when workspace and package content have no changes', async () => {
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: true, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn(async () => WORKSPACE_BASELINE),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace: vi.fn(async () => {}),
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      yes: true,
      bailout: true,
    })

    expect(result).toBe('noop')
  })

  it('writes updated package json when only package changes exist', async () => {
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: true, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn(async () => WORKSPACE_BASELINE),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace: vi.fn(async () => {}),
      },
    }

    const updatedPackages: Record<string, PackageJsonMeta> = {
      'fixture-command-shared': {
        type: 'package.json',
        name: 'fixture-command-shared',
        private: true,
        version: '0.0.0',
        filepath: PACKAGE_JSON_PATH,
        relative: 'package.json',
        raw: {
          name: 'fixture-command-shared',
          version: '0.0.0',
          private: true,
          dependencies: {
            react: 'catalog:prod',
          },
        },
        deps: [],
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      updatedPackages,
      yes: true,
      bailout: false,
    })

    expect(result).toBe('applied')
    expect(noteMock).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('package.json'))

    const pkg = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf-8')) as Record<string, any>
    expect(pkg.dependencies?.react).toBe('catalog:prod')
  })

  it('logs noop info when bailout is disabled and no changes are detected', async () => {
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: true, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn(async () => WORKSPACE_BASELINE),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace: vi.fn(async () => {}),
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      yes: true,
      bailout: false,
    })

    expect(result).toBe('noop')
    expect(logInfoMock).toHaveBeenCalledWith(expect.stringContaining('no changes to pnpm-workspace.yaml'))
  })

  it('writes workspace without confirmation when showDiff is disabled', async () => {
    const writeWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: false, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn()
          .mockResolvedValueOnce(WORKSPACE_BASELINE)
          .mockResolvedValueOnce(`${WORKSPACE_BASELINE}catalogs:\n  dev:\n    vitest: ^4.0.0\n`),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace,
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      yes: false,
      showDiff: false,
    })

    expect(result).toBe('applied')
    expect(confirmMock).not.toHaveBeenCalled()
    expect(writeWorkspace).toHaveBeenCalledTimes(1)
  })

  it('requires confirmation when only package json is updated and yes is disabled', async () => {
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: false, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn(async () => WORKSPACE_BASELINE),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace: vi.fn(async () => {}),
      },
    }

    const updatedPackages: Record<string, PackageJsonMeta> = {
      'fixture-command-shared': {
        type: 'package.json',
        name: 'fixture-command-shared',
        private: true,
        version: '0.0.0',
        filepath: PACKAGE_JSON_PATH,
        relative: 'package.json',
        raw: {
          name: 'fixture-command-shared',
          version: '0.0.0',
          private: true,
          devDependencies: {
            vitest: 'catalog:test',
          },
        },
        deps: [],
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      updatedPackages,
      yes: false,
    })

    expect(result).toBe('applied')
    expect(confirmMock).toHaveBeenCalledTimes(1)
  })

  it('throws abort error when diff confirmation is rejected', async () => {
    confirmMock.mockResolvedValue(false)
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: false, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn()
          .mockResolvedValueOnce(WORKSPACE_BASELINE)
          .mockResolvedValueOnce(`${WORKSPACE_BASELINE}catalog:\n  react: ^19.0.0\n`),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace: vi.fn(async () => {}),
      },
    }

    await expect(confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      yes: false,
      showDiff: true,
    })).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.ABORT,
    })
  })

  it('applies workspace changes when updatedPackages is an empty object', async () => {
    const writeWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: true, install: false }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn()
          .mockResolvedValueOnce(WORKSPACE_BASELINE)
          .mockResolvedValueOnce(`${WORKSPACE_BASELINE}catalogs:\n  test:\n    vitest: ^4.0.0\n`),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace,
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      updatedPackages: {},
      yes: true,
    })

    expect(result).toBe('applied')
    expect(writeWorkspace).toHaveBeenCalledTimes(1)
  })

  it('runs agent install when complete message is provided and install is enabled', async () => {
    const workspace = {
      getOptions: () => createFixtureScenarioOptions(SCENARIO, { yes: true, install: true }),
      getCwd: () => ROOT,
      catalog: {
        toString: vi.fn(async () => WORKSPACE_BASELINE),
        updateWorkspaceOverrides: vi.fn(async () => {}),
        getWorkspacePath: vi.fn(async () => WORKSPACE_PATH),
        writeWorkspace: vi.fn(async () => {}),
      },
    }

    const updatedPackages: Record<string, PackageJsonMeta> = {
      'fixture-command-shared': {
        type: 'package.json',
        name: 'fixture-command-shared',
        private: true,
        version: '0.0.0',
        filepath: PACKAGE_JSON_PATH,
        relative: 'package.json',
        raw: {
          name: 'fixture-command-shared',
          version: '0.0.0',
          private: true,
          dependencies: {
            react: 'catalog:prod',
          },
        },
        deps: [],
      },
    }

    const result = await confirmWorkspaceChanges(async () => {}, {
      workspace: toWorkspace(workspace),
      updatedPackages,
      yes: true,
      completeMessage: 'done',
    })

    expect(result).toBe('applied')
    expect(logInfoMock).toHaveBeenCalledWith(expect.stringContaining('done'))
    expect(xMock).toHaveBeenCalled()
  })
})

describe('ensureWorkspaceFile', () => {
  it('delegates directly to catalog ensureWorkspace for bun', async () => {
    const ensureWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureOptions('bun', { yes: false }),
      getCwd: () => '/repo/packages/app',
      catalog: {
        ensureWorkspace,
      },
    }

    await ensureWorkspaceFile(toWorkspace(workspace))
    expect(ensureWorkspace).toHaveBeenCalledTimes(1)
  })

  it('creates missing workspace file when yes is enabled', async () => {
    vi.spyOn(io, 'detectWorkspaceRoot').mockResolvedValue(ROOT)
    const ensureWorkspace = vi.fn(async () => {})
    const workspace = {
      getOptions: () => createFixtureOptions('vlt', { yes: true }),
      getCwd: () => ROOT,
      catalog: {
        findWorkspaceFile: vi.fn(async () => ''),
        ensureWorkspace,
      },
    }

    await ensureWorkspaceFile(toWorkspace(workspace))

    const created = JSON.parse(await readFile(join(ROOT, 'vlt.json'), 'utf-8')) as Record<string, unknown>
    expect(created).toEqual({})
    expect(ensureWorkspace).toHaveBeenCalledTimes(1)
  })

  it('throws abort when user declines creating missing workspace file', async () => {
    vi.spyOn(io, 'detectWorkspaceRoot').mockResolvedValue(ROOT)
    confirmMock.mockResolvedValue(false)
    const workspace = {
      getOptions: () => createFixtureOptions('vlt', { yes: false }),
      getCwd: () => ROOT,
      catalog: {
        findWorkspaceFile: vi.fn(async () => ''),
        ensureWorkspace: vi.fn(async () => {}),
      },
    }

    await expect(ensureWorkspaceFile(toWorkspace(workspace))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.ABORT,
    })
  })
})

describe('readWorkspacePackageJSON', () => {
  it('returns package.json path and parsed content when valid', async () => {
    const workspace = {
      getCwd: () => ROOT,
    }

    const result = await readWorkspacePackageJSON(toWorkspace(workspace))
    expect(result.pkgPath).toBe(PACKAGE_JSON_PATH)
    expect(result.pkgName).toBe('fixture-command-shared')
  })

  it('throws when package.json does not contain name', async () => {
    const workspace = {
      getCwd: () => getFixtureScenarioPath('unnamed-package'),
    }

    await expect(readWorkspacePackageJSON(toWorkspace(workspace))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })

  it('reads package.json from explicit path', async () => {
    const workspace = {
      getCwd: () => ROOT,
    }

    const result = await readWorkspacePackageJSON(toWorkspace(workspace), APP_PACKAGE_JSON_PATH)
    expect(result.pkgPath).toBe(APP_PACKAGE_JSON_PATH)
    expect(result.pkgName).toBe('app-command-shared')
  })

  it('throws when package.json does not exist', async () => {
    const workspace = {
      getCwd: () => getFixtureScenarioPath('pnpm-empty-workspace'),
    }

    await expect(readWorkspacePackageJSON(toWorkspace(workspace))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.NOT_FOUND,
    })
  })
})
