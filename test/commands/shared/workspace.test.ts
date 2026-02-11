import type { PackageJsonMeta } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_ERROR_CODES, confirmWorkspaceChanges, ensureWorkspaceFile, readWorkspacePackageJSON } from '@/commands/shared'
import { createFixtureOptions, createFixtureScenarioOptions, getFixtureScenarioPath } from '../../_shared'

const SCENARIO = 'command-shared'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
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
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
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

    const pkg = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf-8')) as Record<string, any>
    expect(pkg.dependencies?.react).toBe('catalog:prod')
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
})
