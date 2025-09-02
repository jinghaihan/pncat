import type { PackageJsonMeta, RawDep } from '../src/types'
import { describe, expect, it } from 'vitest'
import { renderChanges } from '../src/utils/render'

describe('renderChanges', () => {
  it('should render "catalog:" for default catalog dependencies', () => {
    const deps: RawDep[] = [
      {
        name: 'eslint',
        specifier: '^8.0.0',
        catalogName: 'default',
        source: 'devDependencies',
        catalog: false,
        catalogable: true,
      },
    ]

    const updatedPackages: Record<string, PackageJsonMeta> = {
      'test-package': {
        name: 'test-package',
        relative: './package.json',
        filepath: '/test/package.json',
        raw: { name: 'test-package' },
        deps: [deps[0]],
        type: 'package.json',
        private: false,
      },
    }

    const result = renderChanges(deps, updatedPackages)

    expect(result).toContain('eslint')
    expect(result).toContain('→')
    expect(result).toContain('catalog:')
    expect(result).not.toContain('default')
  })

  it('should render "catalog:named" for named catalog dependencies', () => {
    const deps: RawDep[] = [
      {
        name: 'vue',
        specifier: '^3.0.0',
        catalogName: 'frontend',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
      },
    ]

    const updatedPackages: Record<string, PackageJsonMeta> = {
      'test-package': {
        name: 'test-package',
        relative: './package.json',
        filepath: '/test/package.json',
        raw: { name: 'test-package' },
        deps: [deps[0]],
        type: 'package.json',
        private: false,
      },
    }

    const result = renderChanges(deps, updatedPackages)

    expect(result).toContain('vue')
    expect(result).toContain('→')
    expect(result).toContain('catalog:')
    expect(result).toContain('frontend')
  })

  it('should handle mixed catalog types correctly', () => {
    const deps: RawDep[] = [
      {
        name: 'eslint',
        specifier: '^8.0.0',
        catalogName: 'default',
        source: 'devDependencies',
        catalog: false,
        catalogable: true,
      },
      {
        name: 'vue',
        specifier: '^3.0.0',
        catalogName: 'frontend',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
      },
      {
        name: 'lodash',
        specifier: '^4.0.0',
        catalogName: 'utils',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
      },
    ]

    const updatedPackages: Record<string, PackageJsonMeta> = {
      'test-package': {
        name: 'test-package',
        relative: './package.json',
        filepath: '/test/package.json',
        raw: { name: 'test-package' },
        deps,
        type: 'package.json',
        private: false,
      },
    }

    const result = renderChanges(deps, updatedPackages)

    // Check that default catalog shows as "catalog:"
    expect(result).toContain('eslint')
    expect(result).toContain('→')
    expect(result).toContain('catalog:')
    // Check that named catalogs show correctly
    expect(result).toContain('catalog:')
    expect(result).toContain('frontend')
    expect(result).toContain('utils')
    // Ensure no "catalog:default" appears
    expect(result).not.toContain('default')
  })

  it('should return empty string when no dependencies', () => {
    const result = renderChanges([], {})
    expect(result).toBe('')
  })
})
