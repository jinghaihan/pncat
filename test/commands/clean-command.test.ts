import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanCommand } from '@/commands/clean'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const SCENARIO = 'command-clean'
const ROOT = getFixtureScenarioPath(SCENARIO)
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const WORKSPACE_BASELINE = `packages:
  - packages/*
`

const WORKSPACE_WITH_ORPHAN_CATALOG = `packages:
  - packages/*
catalog:
  react: ^18.3.1
`

const WORKSPACE_WITH_OVERRIDE_REFERENCE = `packages:
  - packages/*
catalogs:
  frontend:
    react: ^18.3.1
overrides:
  react: catalog:frontend
`

beforeEach(async () => {
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
})

afterAll(async () => {
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
})

describe('cleanCommand', () => {
  it('throws when workspace file is missing', async () => {
    await expect(cleanCommand(createFixtureScenarioOptions('bun-no-lock', {
      install: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.NOT_FOUND,
    })
  })

  it('applies clean changes when orphan workspace deps exist', async () => {
    await writeFile(WORKSPACE_PATH, WORKSPACE_WITH_ORPHAN_CATALOG, 'utf-8')

    await cleanCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).not.toContain('react: ^18.3.1')
  })

  it('keeps catalog dependency when referenced only by workspace overrides', async () => {
    await writeFile(WORKSPACE_PATH, WORKSPACE_WITH_OVERRIDE_REFERENCE, 'utf-8')

    await cleanCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const workspaceYaml = parsePnpmWorkspaceYaml(await readFile(WORKSPACE_PATH, 'utf-8')).toJSON()
    expect(workspaceYaml.catalogs?.frontend?.react).toBe('^18.3.1')
    expect(workspaceYaml.overrides?.react).toBe('catalog:frontend')
  })
})
