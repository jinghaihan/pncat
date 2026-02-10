import type { BunWorkspaceMeta, PackageJson, PackageJsonMeta } from '../../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BunCatalog } from '../../src/catalog-handler/bun-workspace'
import { detectWorkspaceRoot, loadPackages, readJsonFile } from '../../src/io'
import { createFixtureOptions } from '../_shared'

vi.mock('../../src/io', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/io')>()
  return {
    ...actual,
    detectWorkspaceRoot: vi.fn(),
    loadPackages: vi.fn(),
    readJsonFile: vi.fn(),
  }
})

const detectWorkspaceRootMock = vi.mocked(detectWorkspaceRoot)
const loadPackagesMock = vi.mocked(loadPackages)
const readJsonFileMock = vi.mocked(readJsonFile)

function createPackageJsonMeta(filepath: string): PackageJsonMeta {
  return {
    type: 'package.json',
    name: 'app',
    private: true,
    version: '0.0.0',
    filepath,
    relative: 'packages/app/package.json',
    raw: {},
    deps: [],
  }
}

function createBunWorkspaceMeta(filepath: string): BunWorkspaceMeta {
  return {
    type: 'bun-workspace',
    name: 'bun-catalog:default',
    private: true,
    version: '0.0.0',
    filepath,
    relative: 'package.json',
    raw: {},
    deps: [],
  }
}

describe('hasWorkspaceCatalog', () => {
  it('returns false for invalid workspace values', () => {
    expect(BunCatalog.hasWorkspaceCatalog({})).toBe(false)
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: ['packages/*'] })).toBe(false)
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: null })).toBe(false)
  })

  it('returns true when workspace catalog fields exist', () => {
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: { catalog: {} } })).toBe(true)
    expect(BunCatalog.hasWorkspaceCatalog({ workspaces: { catalogs: {} } })).toBe(true)
  })
})

describe('findWorkspaceFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns bun workspace filepath when package list contains bun-workspace meta', async () => {
    loadPackagesMock.mockResolvedValue([
      createPackageJsonMeta('/repo/packages/app/package.json'),
      createBunWorkspaceMeta('/repo/package.json'),
    ])

    const catalog = new BunCatalog(createFixtureOptions('bun'))
    await expect(catalog.findWorkspaceFile()).resolves.toBe('/repo/package.json')
  })

  it('returns undefined when no bun workspace meta exists', async () => {
    loadPackagesMock.mockResolvedValue([
      createPackageJsonMeta('/repo/packages/app/package.json'),
    ])

    const catalog = new BunCatalog(createFixtureOptions('bun'))
    await expect(catalog.findWorkspaceFile()).resolves.toBeUndefined()
  })
})

describe('ensureWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to workspace root package.json when workspace file is missing', async () => {
    loadPackagesMock.mockResolvedValue([])
    detectWorkspaceRootMock.mockResolvedValue('/repo')

    const catalog = new BunCatalog(createFixtureOptions('bun', { cwd: '/repo/packages/app' }))
    await catalog.ensureWorkspace()

    await expect(catalog.getWorkspacePath()).resolves.toBe('/repo/package.json')
    await expect(catalog.toJSON()).resolves.toEqual({})
  })

  it('loads object workspaces from package.json when workspace file exists', async () => {
    loadPackagesMock.mockResolvedValue([
      createBunWorkspaceMeta('/repo/package.json'),
    ])
    const workspaceJson: PackageJson = {
      workspaces: {
        catalog: { react: '^18.3.1' },
        catalogs: { test: { vitest: '^4.0.0' } },
      },
    }
    readJsonFileMock.mockResolvedValue(workspaceJson)

    const catalog = new BunCatalog(createFixtureOptions('bun'))
    await catalog.ensureWorkspace()

    await expect(catalog.getWorkspacePath()).resolves.toBe('/repo/package.json')
    await expect(catalog.toJSON()).resolves.toEqual({
      catalog: { react: '^18.3.1' },
      catalogs: { test: { vitest: '^4.0.0' } },
    })
  })

  it('uses empty workspace json when workspaces is an array', async () => {
    loadPackagesMock.mockResolvedValue([
      createBunWorkspaceMeta('/repo/package.json'),
    ])
    const workspaceJson: PackageJson = {
      workspaces: ['packages/*'],
    }
    readJsonFileMock.mockResolvedValue(workspaceJson)

    const catalog = new BunCatalog(createFixtureOptions('bun'))
    await catalog.ensureWorkspace()

    await expect(catalog.toJSON()).resolves.toEqual({})
  })
})
