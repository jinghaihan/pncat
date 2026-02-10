import type { CatalogHandler, CatalogOptions, PackageMeta } from '../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCatalogHandler } from '../src/catalog-handler'
import { loadPackages } from '../src/io'
import { WorkspaceManager } from '../src/workspace-manager'
import { createFixtureOptions } from './_shared'

vi.mock('../src/catalog-handler', () => ({
  createCatalogHandler: vi.fn(),
}))

vi.mock('../src/io', () => ({
  loadPackages: vi.fn(),
}))

const createCatalogHandlerMock = vi.mocked(createCatalogHandler)
const loadPackagesMock = vi.mocked(loadPackages)

const fakeCatalog: CatalogHandler = {
  options: createFixtureOptions(),
  findWorkspaceFile: vi.fn(),
  ensureWorkspace: vi.fn(),
  toJSON: vi.fn(),
  toString: vi.fn(),
  setPackage: vi.fn(),
  removePackages: vi.fn(),
  getPackageCatalogs: vi.fn(),
  generateCatalogs: vi.fn(),
  cleanupCatalogs: vi.fn(),
  clearCatalogs: vi.fn(),
  getWorkspacePath: vi.fn(),
  writeWorkspace: vi.fn(),
}

const fakePackages: PackageMeta[] = [
  {
    type: 'package.json',
    name: 'app',
    private: true,
    version: '0.0.0',
    filepath: '/repo/packages/app/package.json',
    relative: 'packages/app/package.json',
    raw: {},
    deps: [],
  },
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
]

describe('constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('creates catalog handler with provided options', () => {
    const options = createFixtureOptions()
    const manager = new WorkspaceManager(options)

    expect(createCatalogHandlerMock).toHaveBeenCalledWith(options)
    expect(manager.catalog).toBe(fakeCatalog)
  })
})

describe('getPackages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns loaded packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()
    expect(manager.getPackages()).toEqual(fakePackages)
  })
})

describe('getProjectPackages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns only package.json packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()
    expect(manager.getProjectPackages()).toEqual([fakePackages[0]])
  })
})

describe('getWorkspacePackages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns only workspace packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()
    expect(manager.getWorkspacePackages()).toEqual([fakePackages[1]])
  })
})

describe('loadPackages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('loads packages from io and returns them', async () => {
    const options: CatalogOptions = createFixtureOptions()
    const manager = new WorkspaceManager(options)
    loadPackagesMock.mockResolvedValue(fakePackages)

    await expect(manager.loadPackages()).resolves.toEqual(fakePackages)
    expect(loadPackagesMock).toHaveBeenCalledWith(options)
  })
})

describe('reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('clears loaded packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()
    manager.reset()

    expect(manager.getPackages()).toEqual([])
  })
})
