import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initCommand } from '@/commands/init'
import { createFixtureScenarioOptions, getFixtureScenarioPath } from '../_shared'

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts')
  return {
    ...actual,
    confirm: vi.fn(),
    select: vi.fn(),
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
const outroMock = vi.mocked(p.outro)
const selectMock = vi.mocked(p.select)

const SCENARIO = 'command-init'
const ROOT = getFixtureScenarioPath(SCENARIO)
const NO_DEPENDENCIES_SCENARIO = 'no-dependencies'
const NO_DEPENDENCIES_ROOT = getFixtureScenarioPath(NO_DEPENDENCIES_SCENARIO)
const PACKAGE_JSON_PATH = join(ROOT, 'package.json')
const WORKSPACE_PATH = join(ROOT, 'pnpm-workspace.yaml')
const CONFIG_PATH = join(ROOT, 'pncat.config.ts')
const NO_DEPENDENCIES_CONFIG_PATH = join(NO_DEPENDENCIES_ROOT, 'pncat.config.ts')
const CANCELLED = Symbol('cancelled')

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
  vi.clearAllMocks()
  isCancelMock.mockReturnValue(false)
  confirmMock.mockResolvedValue(true)
  selectMock.mockResolvedValue('extend')

  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await rm(CONFIG_PATH, { force: true })
  await rm(NO_DEPENDENCIES_CONFIG_PATH, { force: true })
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

  it('prompts before overwrite even when yes is enabled', async () => {
    await writeFile(CONFIG_PATH, 'export default {}\n', 'utf-8')

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      install: false,
    }))

    const content = await readFile(CONFIG_PATH, 'utf-8')
    expect(content).toContain('mergeCatalogRules')
    expect(content).not.toContain('export default {}')
    expect(confirmMock).toHaveBeenCalledTimes(1)
  })

  it('aborts when existing config overwrite is declined', async () => {
    await writeFile(CONFIG_PATH, 'export default { keep: true }\n', 'utf-8')
    confirmMock.mockResolvedValueOnce(false)

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
    }))

    const content = await readFile(CONFIG_PATH, 'utf-8')
    expect(content).toBe('export default { keep: true }\n')
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(selectMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('aborting'))
  })

  it('aborts when mode selection is canceled', async () => {
    isCancelMock.mockImplementation(value => value === CANCELLED)
    selectMock.mockResolvedValueOnce(CANCELLED as never)

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
    }))

    expect(existsSync(CONFIG_PATH)).toBe(false)
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('aborting'))
  })

  it('aborts when selected mode is invalid', async () => {
    selectMock.mockResolvedValueOnce('invalid-mode' as never)

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
    }))

    expect(existsSync(CONFIG_PATH)).toBe(false)
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('aborting'))
  })

  it('aborts when eslint confirmation is canceled', async () => {
    isCancelMock.mockImplementation(value => value === CANCELLED)
    selectMock.mockResolvedValueOnce('extend')
    confirmMock.mockResolvedValueOnce(CANCELLED as never)

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
    }))

    expect(existsSync(CONFIG_PATH)).toBe(false)
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('aborting'))
  })

  it('aborts when minimal mode confirmation is declined', async () => {
    selectMock.mockResolvedValueOnce('minimal')
    confirmMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
    }))

    expect(existsSync(CONFIG_PATH)).toBe(false)
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('aborting'))
  })

  it('writes minimal config with matched custom rules', async () => {
    selectMock.mockResolvedValueOnce('minimal')
    confirmMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)

    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
      catalogRules: [
        {
          name: 'custom-lint',
          match: [/eslint/, 'eslint', 'eslint'],
          depFields: ['devDependencies'],
          priority: 42,
          specifierRules: [
            {
              specifier: '^9.0.0',
              match: [/eslint/, 'eslint'],
              name: 'lint-rule',
              suffix: '-next',
            },
          ],
        },
      ],
    }))

    const content = await readFile(CONFIG_PATH, 'utf-8')
    expect(content).toContain(`import { defineConfig } from 'pncat'`)
    expect(content).toContain(`name: 'custom-lint'`)
    expect(content).toContain(`match: [/eslint/, 'eslint']`)
    expect(content).toContain(`depFields: [\"devDependencies\"]`)
    expect(content).toContain(`priority: 42`)
    expect(content).toContain(`specifierRules: [{ specifier: '^9.0.0', match: [/eslint/, 'eslint'], name: 'lint-rule', suffix: '-next' }]`)
    expect(content).toContain(`postRun: 'eslint --fix \"**/package.json\" \"**/pnpm-workspace.yaml\"'`)
  })

  it('writes minimal config with empty rules when no dependencies are present', async () => {
    selectMock.mockResolvedValueOnce('minimal')
    confirmMock.mockResolvedValueOnce(true)

    await initCommand(createFixtureScenarioOptions(NO_DEPENDENCIES_SCENARIO, {
      yes: false,
      install: false,
    }))

    const content = await readFile(NO_DEPENDENCIES_CONFIG_PATH, 'utf-8')
    expect(content).toContain(`catalogRules: [],`)
    expect(content).not.toContain('postRun:')
    expect(content).not.toContain(`exclude: ['@types/vscode']`)
  })

  it('prints migrate force hint when force option is enabled', async () => {
    await initCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: true,
      force: true,
      install: false,
    }))

    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('pncat migrate'))
    expect(outroMock).toHaveBeenCalledWith(expect.stringContaining('-f'))
  })
})
