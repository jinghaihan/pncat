import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeEach, describe, expect, it } from 'vitest'
import { initCommand } from '@/commands/init'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const SCENARIO = 'command-init'
const ROOT = getFixtureScenarioPath(SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')
const CONFIG_PATH = join(ROOT, 'pncat.config.ts')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-init",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "engines": {
    "vscode": "^1.95.0"
  },
  "devDependencies": {
    "eslint": "^9.0.0"
  }
}
`

const WORKSPACE_BASELINE = `packages:
  - packages/*
`

beforeEach(async () => {
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await rm(CONFIG_PATH, { force: true })
})

describe('initCommand', () => {
  it('writes extend config and injects eslint/vscode options', async () => {
    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
    }))

    const content = await readFile(CONFIG_PATH, 'utf-8')
    expect(content).toContain(`import { defineConfig, mergeCatalogRules } from 'pncat'`)
    expect(content).toContain(`catalogRules: mergeCatalogRules([])`)
    expect(content).toContain(`exclude: ['@types/vscode']`)
    expect(content).toContain(`postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"'`)
  })

  it('overwrites existing config without prompts when yes is enabled', async () => {
    await writeFile(CONFIG_PATH, 'export default {}\n', 'utf-8')

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
    }))

    const content = await readFile(CONFIG_PATH, 'utf-8')
    expect(content).toContain('mergeCatalogRules')
    expect(content).not.toContain('export default {}')
  })
})
