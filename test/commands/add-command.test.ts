import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { join } from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addCommand } from '@/commands/add'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { readJsonFile } from '@/io'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const SCENARIO = 'command-add'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const APP_PACKAGE_JSON_PATH = join(ROOT, 'packages/app/package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-add",
  "version": "0.0.0",
  "private": true,
  "peerDependencies": {
    "react": "^17.0.0"
  },
  "optionalDependencies": {
    "react": "^17.0.0"
  },
  "workspaces": [
    "packages/*"
  ],
  "devDependencies": {
    "react": "catalog:dev"
  }
}
`

const WORKSPACE_BASELINE = `packages:
  - packages/*
catalog:
  react: ^17.0.0
catalogs:
  dev:
    react: ^18.3.1
`

const APP_PACKAGE_JSON_BASELINE = `{
  "name": "app-command-add",
  "version": "0.0.0",
  "private": true
}
`

async function restoreScenarioFiles(): Promise<void> {
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(APP_PACKAGE_JSON_PATH, APP_PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
}

beforeEach(async () => {
  await restoreScenarioFiles()
})

afterEach(async () => {
  await restoreScenarioFiles()
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

  it('writes dependency to current package when invoked in workspace subpackage', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(join(ROOT, 'packages/app'))
    process.argv = ['node', 'pncat', 'add', 'lodash-es@^4.17.21']

    await addCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const rootPkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    const appPkg = await readJsonFile<Record<string, any>>(APP_PACKAGE_JSON_PATH)

    expect(rootPkg.dependencies?.['lodash-es']).toBeUndefined()
    expect(appPkg.dependencies?.['lodash-es']).toBe('catalog:prod')
    cwdSpy.mockRestore()
  })
})
