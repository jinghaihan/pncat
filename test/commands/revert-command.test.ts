import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import { join } from 'pathe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { revertCommand } from '@/commands/revert'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { readJsonFile } from '@/io'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

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
const CANCELLED = Symbol('cancelled')

const SCENARIO = 'command-revert'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-revert",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "react": "catalog:prod"
  },
  "workspaces": [
    "packages/*"
  ]
}
`

const WORKSPACE_BASELINE = `packages:
  - packages/*
catalogs:
  prod:
    react: ^18.3.1
`

const PACKAGE_JSON_ORIGINAL = `{
  "name": "fixture-command-revert",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.3.1"
  },
  "workspaces": [
    "packages/*"
  ]
}
`

const WORKSPACE_ORIGINAL = `packages:
  - packages/*
`

beforeEach(async () => {
  vi.clearAllMocks()
  confirmMock.mockResolvedValue(true)
  isCancelMock.mockReturnValue(false)
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
})

afterAll(async () => {
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_ORIGINAL, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_ORIGINAL, 'utf-8')
})

describe('revertCommand', () => {
  it('throws when workspace file is missing', async () => {
    process.argv = ['node', 'pncat', 'revert']

    await expect(revertCommand(createFixtureScenarioOptions('bun-no-lock', {
      install: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.NOT_FOUND,
    })
  })

  it('reverts selected catalog dependency and removes workspace entry', async () => {
    process.argv = ['node', 'pncat', 'revert', 'react']

    await revertCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const pkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    expect(pkg.dependencies?.react).toBe('^18.3.1')

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).not.toContain('react: ^18.3.1')
  })

  it('reverts all catalog dependencies when no specific dependency is provided', async () => {
    process.argv = ['node', 'pncat', 'revert']

    await revertCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const pkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    expect(pkg.dependencies?.react).toBe('^18.3.1')

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).not.toContain('catalogs:')
    expect(workspaceYaml).not.toContain('react: ^18.3.1')
  })

  it('throws abort when full revert confirmation is declined', async () => {
    process.argv = ['node', 'pncat', 'revert']
    confirmMock.mockResolvedValueOnce(false)

    await expect(revertCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
      verbose: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.ABORT,
    })
  })

  it('throws abort when full revert confirmation is canceled', async () => {
    process.argv = ['node', 'pncat', 'revert']
    confirmMock.mockResolvedValueOnce(CANCELLED as never)
    isCancelMock.mockImplementationOnce(value => value === CANCELLED)

    await expect(revertCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
      verbose: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.ABORT,
    })
  })
})
