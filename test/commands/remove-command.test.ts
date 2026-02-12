import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeCommand } from '@/commands/remove'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import * as shared from '@/commands/shared'
import { readJsonFile } from '@/io'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

vi.mock('@/commands/shared', async () => {
  const actual = await vi.importActual<typeof import('@/commands/shared')>('@/commands/shared')
  return {
    ...actual,
    runAgentRemove: vi.fn(),
  }
})

const runAgentRemoveMock = vi.mocked(shared.runAgentRemove)

const SCENARIO = 'command-remove'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-remove",
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

beforeEach(async () => {
  vi.clearAllMocks()
  runAgentRemoveMock.mockResolvedValue(undefined)
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
})

describe('removeCommand', () => {
  it('throws when no dependencies are provided', async () => {
    process.argv = ['node', 'pncat', 'remove']

    await expect(removeCommand(createFixtureScenarioOptions(SCENARIO, {
      install: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })

  it('removes catalog dependency from package and workspace', async () => {
    process.argv = ['node', 'pncat', 'remove', 'react', '-r']

    await removeCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const pkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    expect(pkg.dependencies?.react).toBeUndefined()

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).not.toContain('react: ^18.3.1')
  })
})
