import type { RawDep, WorkspaceSchema } from '@/types'
import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JsonCatalog } from '@/catalog-handler/base/json-workspace'
import { detectIndent, readJsonFile, writeJsonFile } from '@/io'
import { createFixtureOptions, getFixturePath } from '../../_shared'

vi.mock('../../../src/io', () => ({
  detectIndent: vi.fn().mockResolvedValue('  '),
  readJsonFile: vi.fn((filepath: string) => readFile(filepath, 'utf-8').then(content => JSON.parse(content))),
  writeJsonFile: vi.fn(),
}))

function createRawDep(overrides: Partial<RawDep>): RawDep {
  return {
    name: 'react',
    specifier: '^18.3.1',
    source: 'dependencies',
    parents: [],
    catalogable: true,
    catalogName: 'default',
    isCatalog: false,
    ...overrides,
  }
}

class TestJsonCatalog extends JsonCatalog {
  setWorkspaceForTest(workspaceJson: WorkspaceSchema, workspacePath = getFixturePath('vlt', 'vlt.json')): void {
    this.workspaceJson = workspaceJson
    this.workspaceJsonPath = workspacePath
  }

  async readWorkspaceJsonForTest(): Promise<WorkspaceSchema> {
    return await this.getWorkspaceJson()
  }
}

function setWorkspace(catalog: TestJsonCatalog, workspaceJson: WorkspaceSchema, workspacePath = getFixturePath('vlt', 'vlt.json')) {
  catalog.setWorkspaceForTest(workspaceJson, workspacePath)
}

const detectIndentMock = vi.mocked(detectIndent)
const readJsonFileMock = vi.mocked(readJsonFile)
const writeJsonFileMock = vi.mocked(writeJsonFile)

beforeEach(() => {
  vi.clearAllMocks()
  detectIndentMock.mockResolvedValue('  ')
  readJsonFileMock.mockImplementation((filepath: string) => readFile(filepath, 'utf-8').then(content => JSON.parse(content)))
})

describe('findWorkspaceFile', () => {
  it('finds vlt workspace file from fixture cwd', async () => {
    const catalog = new JsonCatalog(createFixtureOptions('vlt'), 'vlt')
    const filepath = await catalog.findWorkspaceFile()
    expect(filepath).toBe(getFixturePath('vlt', 'vlt.json'))
  })
})

describe('ensureWorkspace', () => {
  it('loads catalog fields from workspace file', async () => {
    const catalog = new JsonCatalog(createFixtureOptions('vlt'), 'vlt')
    await catalog.ensureWorkspace()

    const workspace = await catalog.toJSON()
    expect(workspace.catalog).toEqual({ svelte: '^5.0.0' })
    expect(workspace.catalogs).toEqual({
      build: { vite: '^7.0.0' },
    })
  })

  it('throws when workspace file is not found', async () => {
    const catalog = new JsonCatalog(createFixtureOptions('vlt', { cwd: getFixturePath('plain') }), 'vlt')
    await expect(catalog.ensureWorkspace()).rejects.toThrowError('No vlt.json found')
  })
})

describe('toJSON', () => {
  it('returns a deep-cloned workspace object', async () => {
    const catalog = new JsonCatalog(createFixtureOptions('vlt'), 'vlt')
    await catalog.ensureWorkspace()

    const first = await catalog.toJSON()
    first.catalog!.svelte = '0.0.0'

    const second = await catalog.toJSON()
    expect(second.catalog?.svelte).toBe('^5.0.0')
  })
})

describe('toString', () => {
  it('formats workspace json with detected indentation', async () => {
    const catalog = new JsonCatalog(createFixtureOptions('vlt'), 'vlt')
    await catalog.ensureWorkspace()
    detectIndentMock.mockResolvedValue('\t')

    const result = await catalog.toString()
    expect(result).toContain('\n\t"catalog": {')
  })
})

describe('setPackage', () => {
  it('writes default catalog into root catalog map when catalogs.default does not exist', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, { catalogs: { build: {} } })

    await catalog.setPackage('default', 'react', '^19.0.0')
    expect(await catalog.toJSON()).toEqual({
      catalog: { react: '^19.0.0' },
    })
  })

  it('writes default catalog into catalogs.default when it exists', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, { catalogs: { default: {} } })

    await catalog.setPackage('default', 'react', '^19.0.0')
    expect(await catalog.toJSON()).toEqual({
      catalogs: { default: { react: '^19.0.0' } },
    })
  })

  it('writes named catalog into catalogs map', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, {})

    await catalog.setPackage('build', 'vite', '^7.1.0')
    expect(await catalog.toJSON()).toEqual({
      catalogs: { build: { vite: '^7.1.0' } },
    })
  })
})

describe('removePackages', () => {
  it('removes dependencies from default and named catalogs and cleans empty maps', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, {
      catalog: { react: '^18.3.1' },
      catalogs: { build: { vite: '^7.0.0' } },
    })

    await catalog.removePackages([
      createRawDep({ name: 'react', catalogName: 'default' }),
      createRawDep({ name: 'vite', catalogName: 'build' }),
    ])

    expect(await catalog.toJSON()).toEqual({})
  })
})

describe('getPackageCatalogs', () => {
  it('returns all catalogs that include a dependency', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, {
      catalog: { react: '^18.3.1' },
      catalogs: {
        ui: { react: '^19.0.0' },
        build: { vite: '^7.0.0' },
      },
    })

    expect(await catalog.getPackageCatalogs('react')).toEqual(['ui', 'default'])
    expect(await catalog.getPackageCatalogs('vite')).toEqual(['build'])
    expect(await catalog.getPackageCatalogs('unknown')).toEqual([])
  })
})

describe('generateCatalogs', () => {
  it('clears existing catalogs and regenerates sorted catalogs from deps', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, {
      catalog: { old: '1.0.0' },
      catalogs: { z: { old: '1.0.0' } },
    })

    await catalog.generateCatalogs([
      createRawDep({ name: 'react', specifier: '^19.0.0', catalogName: 'ui' }),
      createRawDep({ name: 'vite', specifier: '^7.1.0', catalogName: 'build' }),
      createRawDep({ name: 'vue', specifier: '^3.5.0', catalogName: 'default' }),
    ])

    expect(await catalog.toJSON()).toEqual({
      catalog: {
        vue: '^3.5.0',
      },
      catalogs: {
        build: {
          vite: '^7.1.0',
        },
        ui: {
          react: '^19.0.0',
        },
      },
    })
  })
})

describe('clearCatalogs', () => {
  it('clears all catalog fields from workspace', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, {
      catalog: { react: '^18.3.1' },
      catalogs: { build: { vite: '^7.0.0' } },
    })

    await catalog.clearCatalogs()
    expect(await catalog.toJSON()).toEqual({})
  })
})

describe('getWorkspacePath', () => {
  it('returns existing workspace path without re-loading', async () => {
    const workspacePath = getFixturePath('vlt', 'vlt.json')
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, {}, workspacePath)

    await expect(catalog.getWorkspacePath()).resolves.toBe(workspacePath)
  })

  it('calls ensureWorkspace when workspace path is not initialized', async () => {
    class DeferredJsonCatalog extends JsonCatalog {
      calls = 0

      override async ensureWorkspace(): Promise<void> {
        this.calls += 1
        this.workspaceJsonPath = '/repo/vlt.json'
        this.workspaceJson = {}
      }
    }

    const catalog = new DeferredJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    await expect(catalog.getWorkspacePath()).resolves.toBe('/repo/vlt.json')
    expect(catalog.calls).toBe(1)
  })
})

describe('writeWorkspace', () => {
  it('writes bun workspaces field when agent is bun', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('bun'), 'bun')
    setWorkspace(catalog, { catalog: { react: '^18.3.1' } }, '/repo/package.json')
    const raw = { name: 'repo', workspaces: {} }
    readJsonFileMock.mockResolvedValue(raw)

    await catalog.writeWorkspace()
    expect(writeJsonFileMock).toHaveBeenCalledWith('/repo/package.json', {
      name: 'repo',
      workspaces: { catalog: { react: '^18.3.1' } },
    })
  })

  it('writes vlt catalog fields when agent is vlt', async () => {
    const catalog = new TestJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    setWorkspace(catalog, { catalog: { svelte: '^5.0.0' } }, '/repo/vlt.json')
    const raw = { name: 'repo' }
    readJsonFileMock.mockResolvedValue(raw)

    await catalog.writeWorkspace()
    expect(writeJsonFileMock).toHaveBeenCalledWith('/repo/vlt.json', {
      name: 'repo',
      catalog: { svelte: '^5.0.0' },
      catalogs: undefined,
    })
  })
})

describe('getWorkspaceJson', () => {
  it('calls ensureWorkspace when workspace json is not initialized', async () => {
    class DeferredJsonCatalog extends TestJsonCatalog {
      calls = 0

      override async ensureWorkspace(): Promise<void> {
        this.calls += 1
        this.setWorkspaceForTest({ catalog: { svelte: '^5.0.0' } }, '/repo/vlt.json')
      }
    }

    const catalog = new DeferredJsonCatalog(createFixtureOptions('vlt'), 'vlt')
    await expect(catalog.readWorkspaceJsonForTest()).resolves.toEqual({
      catalog: { svelte: '^5.0.0' },
    })
    expect(catalog.calls).toBe(1)
  })
})
