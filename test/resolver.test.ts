import type { PackageJsonMeta, RawDep } from '../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveConflict, resolveMigrate } from '../src/commands/resolver'

import { createDep } from './_utils'

// Mock the Workspace
const mockPnpmCatalogManager = {
  loadPackages: vi.fn(),
  resolveDep: vi.fn(),
  isCatalogPackage: vi.fn(),
}

describe('resolveConflict', () => {
  it('should select the latest version', async () => {
    const dependencies = new Map<string, Map<string, RawDep[]>>()
    dependencies.set('vue', new Map())
    dependencies.get('vue')!.set(
      'frontend',
      [
        createDep<RawDep>('vue', '1.0.0'),
        createDep<RawDep>('vue', '3.0.0'),
        createDep<RawDep>('vue', '2.0.0'),
      ],
    )
    await resolveConflict(dependencies, { yes: true })
    expect(dependencies.get('vue')?.get('frontend')?.length).toBe(1)
    expect(dependencies.get('vue')?.get('frontend')?.[0].specifier).toBe('3.0.0')
  })
})

describe('resolveMigrate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate "catalog:" for default catalog in package.json', async () => {
    const mockPackages: PackageJsonMeta[] = [
      {
        name: 'test-package',
        type: 'package.json',
        filepath: '/test/package.json',
        relative: './package.json',
        private: false,
        deps: [
          {
            name: 'eslint',
            specifier: '^8.0.0',
            source: 'devDependencies',
            catalog: false,
            catalogable: true,
            catalogName: 'default',
          },
        ],
        raw: {
          name: 'test-package',
          devDependencies: {
            eslint: '^8.0.0',
          },
        },
      },
    ]

    const resolvedDep: RawDep = {
      name: 'eslint',
      specifier: '^8.0.0',
      catalogName: 'default',
      source: 'devDependencies',
      catalog: false,
      catalogable: true,
      update: true,
    }

    mockPnpmCatalogManager.loadPackages.mockResolvedValue(mockPackages)
    mockPnpmCatalogManager.resolveDep.mockReturnValue(resolvedDep)

    const result = await resolveMigrate({
      options: { yes: true },
      workspace: mockPnpmCatalogManager as any,
    })

    expect(result.updatedPackages).toBeDefined()
    const updatedPkg = result.updatedPackages!['test-package']
    expect(updatedPkg).toBeDefined()
    expect(updatedPkg.raw.devDependencies?.eslint).toBe('catalog:')
    expect(updatedPkg.raw.devDependencies?.eslint).not.toBe('catalog:default')
  })

  it('should generate "catalog:named" for named catalog in package.json', async () => {
    const mockPackages: PackageJsonMeta[] = [
      {
        name: 'test-package',
        type: 'package.json',
        filepath: '/test/package.json',
        relative: './package.json',
        private: false,
        deps: [
          {
            name: 'vue',
            specifier: '^3.0.0',
            source: 'dependencies',
            catalog: false,
            catalogable: true,
            catalogName: 'frontend',
          },
        ],
        raw: {
          name: 'test-package',
          dependencies: {
            vue: '^3.0.0',
          },
        },
      },
    ]

    const resolvedDep: RawDep = {
      name: 'vue',
      specifier: '^3.0.0',
      catalogName: 'frontend',
      source: 'dependencies',
      catalog: false,
      catalogable: true,
      update: true,
    }

    mockPnpmCatalogManager.loadPackages.mockResolvedValue(mockPackages)
    mockPnpmCatalogManager.resolveDep.mockReturnValue(resolvedDep)

    const result = await resolveMigrate({
      options: { yes: true },
      workspace: mockPnpmCatalogManager as any,
    })

    expect(result.updatedPackages).toBeDefined()
    const updatedPkg = result.updatedPackages!['test-package']
    expect(updatedPkg).toBeDefined()
    expect(updatedPkg.raw.dependencies?.vue).toBe('catalog:frontend')
  })

  it('should handle multiple dependencies with mixed catalog types', async () => {
    const mockPackages: PackageJsonMeta[] = [
      {
        name: 'test-package',
        type: 'package.json',
        filepath: '/test/package.json',
        relative: './package.json',
        private: false,
        deps: [
          {
            name: 'eslint',
            specifier: '^8.0.0',
            source: 'devDependencies',
            catalog: false,
            catalogable: true,
            catalogName: 'default',
          },
          {
            name: 'vue',
            specifier: '^3.0.0',
            source: 'dependencies',
            catalog: false,
            catalogable: true,
            catalogName: 'frontend',
          },
          {
            name: 'lodash',
            specifier: '^4.0.0',
            source: 'dependencies',
            catalog: false,
            catalogable: true,
            catalogName: 'utils',
          },
        ],
        raw: {
          name: 'test-package',
          dependencies: {
            vue: '^3.0.0',
            lodash: '^4.0.0',
          },
          devDependencies: {
            eslint: '^8.0.0',
          },
        },
      },
    ]

    const resolvedDeps = [
      {
        name: 'eslint',
        specifier: '^8.0.0',
        catalogName: 'default',
        source: 'devDependencies',
        catalog: false,
        catalogable: true,
        update: true,
      },
      {
        name: 'vue',
        specifier: '^3.0.0',
        catalogName: 'frontend',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
        update: true,
      },
      {
        name: 'lodash',
        specifier: '^4.0.0',
        catalogName: 'utils',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
        update: true,
      },
    ]

    mockPnpmCatalogManager.loadPackages.mockResolvedValue(mockPackages)
    mockPnpmCatalogManager.resolveDep
      .mockReturnValueOnce(resolvedDeps[0])
      .mockReturnValueOnce(resolvedDeps[1])
      .mockReturnValueOnce(resolvedDeps[2])

    const result = await resolveMigrate({
      options: { yes: true },
      workspace: mockPnpmCatalogManager as any,
    })

    expect(result.updatedPackages).toBeDefined()
    const updatedPkg = result.updatedPackages!['test-package']
    expect(updatedPkg).toBeDefined()

    // Check that default catalog generates "catalog:"
    expect(updatedPkg.raw.devDependencies?.eslint).toBe('catalog:')
    expect(updatedPkg.raw.devDependencies?.eslint).not.toBe('catalog:default')

    // Check that named catalogs generate correctly
    expect(updatedPkg.raw.dependencies?.vue).toBe('catalog:frontend')
    expect(updatedPkg.raw.dependencies?.lodash).toBe('catalog:utils')
  })

  it('should skip non-catalogable dependencies', async () => {
    const mockPackages: PackageJsonMeta[] = [
      {
        name: 'test-package',
        type: 'package.json',
        filepath: '/test/package.json',
        relative: './package.json',
        private: false,
        deps: [
          {
            name: 'some-package',
            specifier: '^1.0.0',
            source: 'dependencies',
            catalog: false,
            catalogable: false, // Not catalogable
            catalogName: 'default',
          },
        ],
        raw: {
          name: 'test-package',
          dependencies: {
            'some-package': '^1.0.0',
          },
        },
      },
    ]

    mockPnpmCatalogManager.loadPackages.mockResolvedValue(mockPackages)

    const result = await resolveMigrate({
      options: { yes: true },
      workspace: mockPnpmCatalogManager as any,
    })

    // Should not update any packages since dependency is not catalogable
    expect(Object.keys(result.updatedPackages || {})).toHaveLength(0)
  })

  it('should skip dependencies that do not need updates', async () => {
    const mockPackages: PackageJsonMeta[] = [
      {
        name: 'test-package',
        type: 'package.json',
        filepath: '/test/package.json',
        relative: './package.json',
        private: false,
        deps: [
          {
            name: 'eslint',
            specifier: '^8.0.0',
            source: 'devDependencies',
            catalog: false,
            catalogable: true,
            catalogName: 'default',
          },
        ],
        raw: {
          name: 'test-package',
          devDependencies: {
            eslint: '^8.0.0',
          },
        },
      },
    ]

    const resolvedDep: RawDep = {
      name: 'eslint',
      specifier: '^8.0.0',
      catalogName: 'default',
      source: 'devDependencies',
      catalog: false,
      catalogable: true,
      update: false, // No update needed
    }

    mockPnpmCatalogManager.loadPackages.mockResolvedValue(mockPackages)
    mockPnpmCatalogManager.resolveDep.mockReturnValue(resolvedDep)

    const result = await resolveMigrate({
      options: { yes: true },
      workspace: mockPnpmCatalogManager as any,
    })

    // Should not update any packages since dependency doesn't need update
    expect(Object.keys(result.updatedPackages || {})).toHaveLength(0)
  })
})
