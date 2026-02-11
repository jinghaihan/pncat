import type { CatalogHandler, CatalogOptions, PackageMeta } from '../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCatalogHandler } from '../src/catalog-handler'
import { loadPackages } from '../src/io'
import { WorkspaceManager } from '../src/workspace-manager'
import { createFixtureOptions, getFixtureCwd } from './_shared'

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

describe('getOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns the original catalog options', () => {
    const options = createFixtureOptions('pnpm', { yes: true })
    const manager = new WorkspaceManager(options)

    expect(manager.getOptions()).toBe(options)
  })
})

describe('getCwd', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns normalized cwd from options', () => {
    const manager = new WorkspaceManager(createFixtureOptions('pnpm'))

    expect(manager.getCwd()).toBe(getFixtureCwd('pnpm'))
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

describe('getDepNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('collects unique dependency names from project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()

    expect(manager.getDepNames()).toEqual(['eslint', 'vitest'])
  })
})

describe('hasEslint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns true when eslint dependency exists in project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()
    expect(manager.hasEslint()).toBe(true)
  })
})

describe('hasVSCodeEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('returns true when vscode engine exists in project packages', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock.mockResolvedValue(fakePackages)

    await manager.loadPackages()
    expect(manager.hasVSCodeEngine()).toBe(true)
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

  it('reuses the same loading task and only loads once', async () => {
    const options: CatalogOptions = createFixtureOptions()
    const manager = new WorkspaceManager(options)
    loadPackagesMock.mockResolvedValue(fakePackages)

    await Promise.all([manager.loadPackages(), manager.loadPackages()])
    await manager.loadPackages()

    expect(loadPackagesMock).toHaveBeenCalledTimes(1)
  })
})

describe('getCatalogIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('creates dep catalog index from workspace schema', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    vi.mocked(fakeCatalog.toJSON).mockResolvedValue({
      catalog: {
        react: '^18.3.1',
      },
      catalogs: {
        test: {
          vitest: '^4.0.0',
        },
      },
    })

    const index = await manager.getCatalogIndex()
    expect(index.get('react')).toEqual([
      {
        catalogName: 'default',
        specifier: '^18.3.1',
      },
    ])
    expect(index.get('vitest')).toEqual([
      {
        catalogName: 'test',
        specifier: '^4.0.0',
      },
    ])
  })
})

describe('resolveCatalogDependency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCatalogHandlerMock.mockReturnValue(fakeCatalog)
  })

  it('resolves catalog: specifier from existing catalog entry', () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    const resolved = manager.resolveCatalogDependency(
      {
        name: 'react',
        specifier: 'catalog:prod',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: true,
      },
      new Map([
        ['react', [{ catalogName: 'prod', specifier: '^18.3.1' }]],
      ]),
      false,
    )

    expect(resolved.specifier).toBe('^18.3.1')
    expect(resolved.catalogName).toBe('prod')
    expect(resolved.update).toBe(false)
  })

  it('keeps original catalog when force is enabled', () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    const resolved = manager.resolveCatalogDependency(
      {
        name: 'react',
        specifier: 'catalog:prod',
        source: 'dependencies',
        parents: [],
        catalogable: true,
        catalogName: 'prod',
        isCatalog: true,
      },
      new Map([
        ['react', [{ catalogName: 'legacy', specifier: '^18.3.1' }]],
      ]),
      true,
    )

    expect(resolved.catalogName).toBe('prod')
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
    expect(manager.getDepNames()).toEqual([])
  })

  it('clears cache so next load reads packages again', async () => {
    const manager = new WorkspaceManager(createFixtureOptions())
    loadPackagesMock
      .mockResolvedValueOnce(fakePackages)
      .mockResolvedValueOnce(fakePackages)

    await manager.loadPackages()
    manager.reset()
    await manager.loadPackages()

    expect(loadPackagesMock).toHaveBeenCalledTimes(2)
  })
})
