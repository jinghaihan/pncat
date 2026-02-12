import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { migrateCommand } from '@/commands/migrate'
import { readJsonFile } from '@/io'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const SCENARIO = 'command-migrate'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const OVERRIDES_SCENARIO = 'command-migrate-overrides-only'
const OVERRIDES_ROOT = getFixtureScenarioPath(OVERRIDES_SCENARIO)
const OVERRIDES_PACKAGE_JSON_PATH = join(OVERRIDES_ROOT, 'package.json')
const OVERRIDES_WORKSPACE_PATH = join(OVERRIDES_ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-migrate",
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

const WORKSPACE_BASELINE = `packages:
  - packages/*
`

const OVERRIDES_PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-migrate-overrides-only",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ]
}
`

const OVERRIDES_WORKSPACE_BASELINE = `packages: []
overrides:
  react: ^18.2.0
`

beforeEach(async () => {
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_PACKAGE_JSON_PATH, OVERRIDES_PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_WORKSPACE_PATH, OVERRIDES_WORKSPACE_BASELINE, 'utf-8')
})

afterAll(async () => {
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_PACKAGE_JSON_PATH, OVERRIDES_PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_WORKSPACE_PATH, OVERRIDES_WORKSPACE_BASELINE, 'utf-8')
})

describe('migrateCommand', () => {
  it('migrates package dependencies into workspace catalogs and catalog specifiers', async () => {
    await migrateCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const pkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    expect(pkg.dependencies?.react).toBe('catalog:prod')

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).toContain('catalogs:')
    expect(workspaceYaml).toContain('prod:')
    expect(workspaceYaml).toContain('react: ^18.3.1')
  })

  it('migrates workspace overrides-only dependencies into catalogs and override specifiers', async () => {
    await migrateCommand(createFixtureScenarioOptions(OVERRIDES_SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const workspaceYaml = await readFile(OVERRIDES_WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).toContain('catalogs:')
    expect(workspaceYaml).toContain('react: ^18.2.0')
    expect(workspaceYaml).toContain('overrides:')
    expect(workspaceYaml).toMatch(/react: catalog:[a-z0-9-]+/)
  })
})
