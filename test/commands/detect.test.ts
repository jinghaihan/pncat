import { writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import c from 'ansis'
import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectCommand } from '@/commands/detect'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

const ROOT = getFixtureScenarioPath('command-detect')
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')

const PACKAGE_JSON_BASELINE = `{
  "name": "fixture-command-detect",
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

vi.mock('@clack/prompts', () => ({
  note: vi.fn(),
  outro: vi.fn(),
  log: {
    info: vi.fn(),
  },
}))

describe('detectCommand', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
    await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  })

  it('prints detected changes and migration hint', async () => {
    await detectCommand(createFixtureScenarioOptions('command-detect', {
      force: true,
      install: false,
      verbose: false,
    }))

    const noteMock = vi.mocked(p.note)
    expect(p.log.info).toHaveBeenCalledTimes(1)
    expect(noteMock).toHaveBeenCalledTimes(1)
    const noteMessage = noteMock.mock.calls[0]?.[0]
    expect(typeof noteMessage).toBe('string')
    expect(c.strip(noteMessage as string)).toContain('pncat migrate -f')
    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('detect complete'))
  })

  it('prints no-op message when no dependencies need migration', async () => {
    await detectCommand(createFixtureScenarioOptions('command-detect-noop', {
      install: false,
      verbose: false,
    }))

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('no dependencies to migrate'))
    expect(p.note).not.toHaveBeenCalled()
  })
})
