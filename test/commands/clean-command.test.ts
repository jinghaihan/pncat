import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeEach, describe, expect, it } from 'vitest'
import { cleanCommand } from '@/commands/clean'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const SCENARIO = 'command-clean'
const ROOT = getFixtureScenarioPath(SCENARIO)
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const WORKSPACE_BASELINE = `packages:
  - packages/*
catalog:
  react: ^18.3.1
`

beforeEach(async () => {
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
    await cleanCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
      verbose: false,
    }))

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).not.toContain('react: ^18.3.1')
  })
})
