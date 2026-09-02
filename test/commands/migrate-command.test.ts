import { readFile, writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { join } from 'pathe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { migrateCommand } from '@/commands/migrate'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import { readJsonFile } from '@/io'
import { createFixtureOptions, createFixtureScenarioOptions, getFixturePath, getFixtureScenarioPath } from '../_shared'

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts')
  return {
    ...actual,
    confirm: vi.fn(),
    isCancel: vi.fn(),
    multiselect: vi.fn(),
    note: vi.fn(),
    outro: vi.fn(),
    select: vi.fn(),
    text: vi.fn(),
    log: {
      ...actual.log,
      info: vi.fn(),
      warn: vi.fn(),
    },
  }
})

const confirmMock = vi.mocked(p.confirm)
const isCancelMock = vi.mocked(p.isCancel)
const textMock = vi.mocked(p.text)
const selectMock = vi.mocked(p.select)

const CONFLICT_ROOT = getFixturePath('pnpm', 'migrate-catalog-conflicts-command')
const CONFLICT_FILES = ['package.json', 'packages/app/package.json', 'pnpm-workspace.yaml'].map(path => join(CONFLICT_ROOT, path))
const CONFLICT_BASELINES = await Promise.all(CONFLICT_FILES.map(path => readFile(path, 'utf8')))

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
  vi.clearAllMocks()
  confirmMock.mockResolvedValue(true)
  isCancelMock.mockReturnValue(false)
  textMock.mockResolvedValue('ui')
  selectMock.mockReset().mockResolvedValue('dev')
  await Promise.all(CONFLICT_FILES.map((path, index) => writeFile(path, CONFLICT_BASELINES[index], 'utf8')))

  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_PACKAGE_JSON_PATH, OVERRIDES_PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_WORKSPACE_PATH, OVERRIDES_WORKSPACE_BASELINE, 'utf-8')
})

afterAll(async () => {
  await Promise.all(CONFLICT_FILES.map((path, index) => writeFile(path, CONFLICT_BASELINES[index], 'utf8')))
  await writeFile(PACKAGE_JSON_PATH, PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(WORKSPACE_PATH, WORKSPACE_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_PACKAGE_JSON_PATH, OVERRIDES_PACKAGE_JSON_BASELINE, 'utf-8')
  await writeFile(OVERRIDES_WORKSPACE_PATH, OVERRIDES_WORKSPACE_BASELINE, 'utf-8')
})

describe('migrateCommand', () => {
  it('requires one catalog with --yes, persists every reference, and remains stable on rerun', async () => {
    const options = createFixtureOptions('pnpm', { cwd: CONFLICT_ROOT, yes: true, force: true, install: false })

    await migrateCommand(options)

    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).not.toHaveBeenCalled()
    const migrated = await Promise.all(CONFLICT_FILES.map(path => readFile(path, 'utf8')))
    const root = JSON.parse(migrated[0])
    const app = JSON.parse(migrated[1])
    expect(root.devDependencies).toEqual({ '@devframes/hub': 'catalog:dev' })
    expect(root.dependencies).toBeUndefined()
    expect(app.dependencies).toEqual({ '@devframes/hub': 'catalog:dev' })
    expect(app.devDependencies).toBeUndefined()
    expect(parse(migrated[2]).catalogs).toEqual({ dev: { '@devframes/hub': '^0.9.7' } })

    selectMock.mockClear()
    await migrateCommand({ ...options, force: false })
    expect(selectMock).not.toHaveBeenCalled()
    expect(await Promise.all(CONFLICT_FILES.map(path => readFile(path, 'utf8')))).toEqual(migrated)
  })

  it('does not write files when catalog selection is canceled with --yes', async () => {
    isCancelMock.mockReturnValue(true)

    await expect(migrateCommand(createFixtureOptions('pnpm', {
      cwd: CONFLICT_ROOT,
      yes: true,
      force: true,
      install: false,
    }))).rejects.toMatchObject({ code: COMMAND_ERROR_CODES.ABORT })

    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(await Promise.all(CONFLICT_FILES.map(path => readFile(path, 'utf8')))).toEqual(CONFLICT_BASELINES)
  })

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

  it('lets denied migrate changes adjust dependency catalogs and confirm again', async () => {
    confirmMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    await migrateCommand(createFixtureScenarioOptions(SCENARIO, {
      yes: false,
      install: false,
      verbose: false,
    }))

    const pkg = await readJsonFile<Record<string, any>>(PACKAGE_JSON_PATH)
    expect(pkg.dependencies?.react).toBe('catalog:ui')

    const workspaceYaml = await readFile(WORKSPACE_PATH, 'utf-8')
    expect(workspaceYaml).toContain('ui:')
    expect(workspaceYaml).toContain('react: ^18.3.1')
    expect(workspaceYaml).not.toContain('prod:')
  })
})
