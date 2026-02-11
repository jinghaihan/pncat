import type { RawDep } from '@/types'
import { writeFile } from 'node:fs/promises'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YamlCatalog } from '@/catalog-handler/base/yaml-workspace'
import { createFixtureOptions, getFixturePath } from '../../_shared'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    writeFile: vi.fn(),
  }
})

const writeFileMock = vi.mocked(writeFile)

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

function createEmptyWorkspaceYaml() {
  return parsePnpmWorkspaceYaml('packages:\n  - packages/*\n')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadWorkspace', () => {
  it('loads default catalogs, named catalogs, and overrides from yaml workspace', async () => {
    const packages = await YamlCatalog.loadWorkspace(
      'pnpm-workspace.yaml',
      createFixtureOptions(),
      () => true,
    )

    expect(packages?.map(pkg => pkg.name)).toEqual([
      'pnpm-catalog:default',
      'pnpm-catalog:test',
      'pnpm-workspace:overrides',
    ])
  })

  it('returns empty entries when yaml has no catalog fields', async () => {
    const packages = await YamlCatalog.loadWorkspace(
      'pnpm-workspace.empty.yaml',
      createFixtureOptions(),
      () => true,
    )

    expect(packages).toEqual([])
  })
})

describe('findWorkspaceFile', () => {
  it('finds pnpm workspace file from fixture cwd', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    const filepath = await catalog.findWorkspaceFile()
    expect(filepath).toBe(getFixturePath('pnpm', 'pnpm-workspace.yaml'))
  })
})

describe('ensureWorkspace', () => {
  it('loads workspace yaml context', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    const workspace = await catalog.toJSON()
    expect(workspace.catalog).toEqual({ react: '^18.3.1' })
    expect(workspace.catalogs).toEqual({
      test: { vitest: '^4.0.0' },
    })
    expect(workspace.overrides).toEqual({ react: 'catalog:' })
  })

  it('throws when workspace file is not found', async () => {
    class MissingWorkspaceCatalog extends YamlCatalog {
      override async findWorkspaceFile(): Promise<string | undefined> {
        return undefined
      }
    }

    const catalog = new MissingWorkspaceCatalog(createFixtureOptions(), 'pnpm')
    await expect(catalog.ensureWorkspace()).rejects.toThrowError('No pnpm-workspace.yaml found')
  })
})

describe('toJSON', () => {
  it('returns a deep clone of workspace yaml json', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    const first = await catalog.toJSON()
    first.catalog!.react = '0.0.0'

    const second = await catalog.toJSON()
    expect(second.catalog?.react).toBe('^18.3.1')
  })
})

describe('toString', () => {
  it('returns serialized workspace yaml content', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    const content = await catalog.toString()
    expect(content).toContain('catalog:')
    expect(content).toContain('react: ^18.3.1')
  })
})

describe('setPackage', () => {
  it('sets dependency in default and named catalogs', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.setPackage('default', 'vue', '^3.5.0')
    await catalog.setPackage('lint', 'eslint', '^9.0.0')

    expect(await catalog.toJSON()).toEqual({
      catalog: {
        react: '^18.3.1',
        vue: '^3.5.0',
      },
      catalogs: {
        lint: { eslint: '^9.0.0' },
        test: { vitest: '^4.0.0' },
      },
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })
})

describe('removePackages', () => {
  it('removes dependencies and cleans empty catalogs', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.setPackage('lint', 'eslint', '^9.0.0')
    await catalog.removePackages([
      createRawDep({ name: 'react', catalogName: 'default' }),
      createRawDep({ name: 'vitest', catalogName: 'test' }),
      createRawDep({ name: 'eslint', catalogName: 'lint' }),
    ])

    expect(await catalog.toJSON()).toEqual({
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })

  it('keeps workspace unchanged when target deps do not exist', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.removePackages([
      createRawDep({ name: 'missing-default', catalogName: 'default' }),
      createRawDep({ name: 'missing-lint', catalogName: 'lint' }),
    ])

    expect(await catalog.toJSON()).toEqual({
      catalog: {
        react: '^18.3.1',
      },
      catalogs: {
        test: { vitest: '^4.0.0' },
      },
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })
})

describe('getPackageCatalogs', () => {
  it('returns catalogs containing a package', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    expect(await catalog.getPackageCatalogs('react')).toEqual(['default'])
    expect(await catalog.getPackageCatalogs('vitest')).toEqual(['test'])
    expect(await catalog.getPackageCatalogs('unknown')).toEqual([])
  })
})

describe('generateCatalogs', () => {
  it('rebuilds default and named catalogs from deps', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.generateCatalogs([
      createRawDep({ name: 'vue', specifier: '^3.5.0', catalogName: 'default' }),
      createRawDep({ name: 'eslint', specifier: '^9.0.0', catalogName: 'lint' }),
      createRawDep({ name: 'vitest', specifier: '^4.0.0', catalogName: 'test' }),
    ])

    expect(await catalog.toJSON()).toEqual({
      catalog: {
        vue: '^3.5.0',
      },
      catalogs: {
        lint: { eslint: '^9.0.0' },
        test: { vitest: '^4.0.0' },
      },
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })
})

describe('clearCatalogs', () => {
  it('removes catalog and catalogs sections', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.clearCatalogs()
    expect(await catalog.toJSON()).toEqual({
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })
})

describe('cleanupCatalogs', () => {
  it('keeps non-empty catalog sections', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.cleanupCatalogs()
    expect(await catalog.toJSON()).toEqual({
      catalog: {
        react: '^18.3.1',
      },
      catalogs: {
        test: { vitest: '^4.0.0' },
      },
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })

  it('works when named catalogs section is absent', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.clearCatalogs()
    await catalog.setPackage('default', 'vue', '^3.5.0')
    await catalog.cleanupCatalogs()

    expect(await catalog.toJSON()).toEqual({
      catalog: {
        vue: '^3.5.0',
      },
      overrides: {
        react: 'catalog:',
      },
      packages: ['packages/*'],
    })
  })
})

describe('getWorkspacePath', () => {
  it('returns workspace path after ensureWorkspace', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()
    await expect(catalog.getWorkspacePath()).resolves.toBe(getFixturePath('pnpm', 'pnpm-workspace.yaml'))
  })

  it('calls ensureWorkspace when workspace path is not initialized', async () => {
    class DeferredYamlCatalog extends YamlCatalog {
      calls = 0

      override async ensureWorkspace(): Promise<void> {
        this.calls += 1
        this.workspaceYamlPath = '/repo/pnpm-workspace.yaml'
        this.workspaceYaml = createEmptyWorkspaceYaml()
      }
    }

    const catalog = new DeferredYamlCatalog(createFixtureOptions(), 'pnpm')
    await expect(catalog.getWorkspacePath()).resolves.toBe('/repo/pnpm-workspace.yaml')
    expect(catalog.calls).toBe(1)
  })
})

describe('writeWorkspace', () => {
  it('writes serialized yaml workspace to workspace path', async () => {
    const catalog = new YamlCatalog(createFixtureOptions(), 'pnpm')
    await catalog.ensureWorkspace()

    await catalog.writeWorkspace()
    expect(writeFileMock).toHaveBeenCalledWith(
      getFixturePath('pnpm', 'pnpm-workspace.yaml'),
      expect.any(String),
      'utf-8',
    )
  })
})

describe('getWorkspaceYaml', () => {
  it('calls ensureWorkspace when workspace yaml is not initialized', async () => {
    class DeferredYamlCatalog extends YamlCatalog {
      calls = 0

      override async ensureWorkspace(): Promise<void> {
        this.calls += 1
        this.workspaceYamlPath = '/repo/pnpm-workspace.yaml'
        this.workspaceYaml = createEmptyWorkspaceYaml()
      }

      async readWorkspaceYaml() {
        return await this.getWorkspaceYaml()
      }
    }

    const catalog = new DeferredYamlCatalog(createFixtureOptions(), 'pnpm')
    await expect(catalog.readWorkspaceYaml()).resolves.toBeDefined()
    expect(catalog.calls).toBe(1)
  })
})
