import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { join } from 'pathe'
import { beforeEach, describe, expect, it } from 'vitest'
import { addCommand } from '@/commands/add'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { readJsonFile } from '@/io'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const SCENARIO = 'command-add'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-add",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "react": "^17.0.0"
  },
  "peerDependencies": {
    "react": "^17.0.0"
  },
  "optionalDependencies": {
    "react": "^17.0.0"
  },
  "workspaces": [
    "packages/*"
  ]
}
`

const WORKSPACE_BASELINE = `packages:
  - packages/*
catalog:
  react: ^17.0.0
`

beforeEach(async () => {
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
})

describe('addCommand', () => {
  it('throws when no dependencies are provided', async () => {
    process.argv = ['node', 'pncat', 'add']

    await expect(addCommand(createFixtureScenarioOptions(SCENARIO, {
      install: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })

  it('updates package json deps and writes catalog entry', async () => {
    process.argv = ['node', 'pncat', 'add', 'react@^18.3.1', '-D']

    await addCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const pkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    expect(pkg.dependencies?.react).toBeUndefined()
    expect(pkg.peerDependencies?.react).toBe('^17.0.0')
    expect(pkg.optionalDependencies?.react).toBe('^17.0.0')
    expect(pkg.devDependencies?.react).toBe('catalog:dev')

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).toContain('catalogs:')
    expect(workspaceYaml).toContain('dev:')
    expect(workspaceYaml).toContain('react: ^18.3.1')
  })
})
