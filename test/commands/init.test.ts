import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initCommand } from '@/commands/init'
import { loadPackages } from '@/io'
import { createFixtureOptions, getFixtureCwd } from '../_shared'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
}))

vi.mock('../../src/io', () => ({
  loadPackages: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
  note: vi.fn(),
  log: {
    info: vi.fn(),
  },
  isCancel: vi.fn(),
  outro: vi.fn(),
}))

const existsSyncMock = vi.mocked(existsSync)
const writeFileMock = vi.mocked(writeFile)
const loadPackagesMock = vi.mocked(loadPackages)
const confirmMock = vi.mocked(p.confirm)
const selectMock = vi.mocked(p.select)
const isCancelMock = vi.mocked(p.isCancel)
const outroMock = vi.mocked(p.outro)

describe('initCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existsSyncMock.mockReturnValue(false)
    isCancelMock.mockReturnValue(false)
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [],
      },
    ])
    selectMock.mockResolvedValue('extend')
  })

  it('writes extend config and injects eslint/vscode options', async () => {
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {
          engines: {
            vscode: '^1.95.0',
          },
        },
        deps: [
          {
            name: 'eslint',
            specifier: '^9.0.0',
            source: 'devDependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
        ],
      },
    ])
    confirmMock.mockResolvedValue(true)

    const options = createFixtureOptions('pnpm')
    await initCommand(options)

    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(selectMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledWith(
      join(getFixtureCwd('pnpm'), 'pncat.config.ts'),
      expect.stringContaining(`import { defineConfig, mergeCatalogRules } from 'pncat'`),
      'utf-8',
    )

    const content = writeFileMock.mock.calls[0][1] as string
    expect(content).toContain(`catalogRules: mergeCatalogRules([])`)
    expect(content).toContain(`exclude: ['@types/vscode']`)
    expect(content).toContain(`postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',`)
  })

  it('writes minimal config with matched rules', async () => {
    selectMock.mockResolvedValue('minimal')
    confirmMock.mockResolvedValue(true)
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [
          {
            name: 'vitest',
            specifier: '^4.0.0',
            source: 'devDependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
        ],
      },
    ])

    await initCommand(createFixtureOptions('pnpm'))
    const content = writeFileMock.mock.calls[0][1] as string

    expect(content).toContain(`import { defineConfig } from 'pncat'`)
    expect(content).toContain(`catalogRules: [`)
    expect(content).toContain(`name: 'test'`)
  })

  it('writes empty minimal catalogRules when no package deps are detected', async () => {
    selectMock.mockResolvedValue('minimal')
    confirmMock.mockResolvedValue(true)
    loadPackagesMock.mockResolvedValue([
      {
        type: 'pnpm-workspace.yaml',
        name: 'pnpm-catalog:default',
        private: true,
        version: '',
        filepath: '/repo/pnpm-workspace.yaml',
        relative: 'pnpm-workspace.yaml',
        raw: {},
        context: {},
        deps: [],
      },
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [],
      },
    ])

    await initCommand(createFixtureOptions('pnpm'))
    const content = writeFileMock.mock.calls[0][1] as string
    expect(content).toContain(`catalogRules: [],`)
  })

  it('aborts when config file exists and overwrite is declined', async () => {
    existsSyncMock.mockReturnValue(true)
    confirmMock.mockResolvedValue(false)

    await initCommand(createFixtureOptions('pnpm'))

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(loadPackagesMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledTimes(1)
  })

  it('overwrites existing config without prompts when yes is enabled', async () => {
    existsSyncMock.mockReturnValue(true)
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [
          {
            name: 'eslint',
            specifier: '^9.0.0',
            source: 'devDependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
        ],
      },
    ])

    await initCommand(createFixtureOptions('pnpm', { yes: true }))

    expect(selectMock).not.toHaveBeenCalled()
    expect(confirmMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledTimes(1)

    const content = writeFileMock.mock.calls[0][1] as string
    expect(content).toContain(`postRun: 'eslint --fix "**/package.json" "**/pnpm-workspace.yaml"',`)
  })

  it('aborts minimal flow when continue confirmation is declined', async () => {
    selectMock.mockResolvedValue('minimal')
    confirmMock.mockResolvedValue(false)
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [
          {
            name: 'react',
            specifier: '^18.3.0',
            source: 'dependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
        ],
      },
    ])

    await initCommand(createFixtureOptions('pnpm'))
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('aborts when mode selection is cancelled', async () => {
    selectMock.mockResolvedValue('extend')
    isCancelMock.mockReturnValueOnce(true)

    await initCommand(createFixtureOptions('pnpm'))

    expect(writeFileMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledTimes(1)
  })

  it('aborts when selected mode is invalid', async () => {
    selectMock.mockResolvedValue('invalid-mode')

    await initCommand(createFixtureOptions('pnpm'))

    expect(writeFileMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledTimes(1)
  })

  it('aborts when eslint prompt is cancelled', async () => {
    selectMock.mockResolvedValue('extend')
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [
          {
            name: 'eslint',
            specifier: '^9.0.0',
            source: 'devDependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
        ],
      },
    ])
    confirmMock.mockResolvedValue(true)
    isCancelMock.mockReturnValueOnce(false).mockReturnValueOnce(true)

    await initCommand(createFixtureOptions('pnpm'))

    expect(writeFileMock).not.toHaveBeenCalled()
    expect(outroMock).toHaveBeenCalledTimes(1)
  })

  it('serializes minimal rules with string, regex, and specifier rules', async () => {
    selectMock.mockResolvedValue('minimal')
    confirmMock.mockResolvedValue(true)
    loadPackagesMock.mockResolvedValue([
      {
        type: 'package.json',
        name: 'app',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {},
        deps: [
          {
            name: `o'hara`,
            specifier: '^1.2.3',
            source: 'dependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
          {
            name: 'oh-package',
            specifier: '^1.0.0',
            source: 'dependencies',
            parents: [],
            catalogable: true,
            catalogName: 'default',
            isCatalog: false,
          },
        ],
      },
    ])

    await initCommand(createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'custom',
          match: [`o'hara`, /^oh/],
          specifierRules: [
            {
              specifier: '^1.0.0',
              match: [`o'hara`],
              name: 'custom-rule',
              suffix: 'v1',
            },
          ],
        },
      ],
    }))

    const content = writeFileMock.mock.calls[0][1] as string
    expect(content).toContain(`name: 'custom'`)
    expect(content).toContain(`match: ['o\\'hara', /^oh/]`)
    expect(content).toContain(`specifierRules: [{ specifier: '^1.0.0', match: ['o\\'hara'], name: 'custom-rule', suffix: 'v1' }]`)
  })
})
