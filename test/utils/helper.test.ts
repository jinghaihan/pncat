import type { CatalogOptions } from '@/types'
import process from 'node:process'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_OPTIONS } from '@/constants'
import {
  extractCatalogName,
  getCwd,
  getDepSource,
  hasEslint,
  hasVSCodeEngine,
  isCatalogPackageName,
  isCatalogSpecifier,
  isCatalogWorkspace,
  isDepFieldEnabled,
  isPnpmOverridesPackageName,
} from '@/utils'

describe('getDepSource', () => {
  it('returns dependency source based on save flags', () => {
    expect(getDepSource()).toBe('dependencies')
    expect(getDepSource(true, false, false)).toBe('devDependencies')
    expect(getDepSource(false, true, false)).toBe('optionalDependencies')
    expect(getDepSource(false, false, true)).toBe('peerDependencies')
  })
})

describe('getCwd', () => {
  it('returns resolved options cwd', () => {
    const options: CatalogOptions = { cwd: './test/fixtures/pnpm' }
    expect(getCwd(options)).toBe(resolve('./test/fixtures/pnpm'))
  })

  it('falls back to process cwd when options cwd is missing', () => {
    expect(getCwd()).toBe(resolve(process.cwd()))
  })
})

describe('isDepFieldEnabled', () => {
  it('returns true when dep field is enabled', () => {
    expect(isDepFieldEnabled(DEFAULT_CATALOG_OPTIONS, 'dependencies')).toBe(true)
  })

  it('returns false when dep field is missing or disabled', () => {
    expect(isDepFieldEnabled({ ...DEFAULT_CATALOG_OPTIONS, depFields: {} }, 'dependencies')).toBe(false)
  })
})

describe('isCatalogSpecifier', () => {
  it('checks catalog protocol prefix', () => {
    expect(isCatalogSpecifier('catalog:test')).toBe(true)
    expect(isCatalogSpecifier('^1.0.0')).toBe(false)
  })
})

describe('isCatalogWorkspace', () => {
  it('returns true for workspace dep types', () => {
    expect(isCatalogWorkspace('pnpm-workspace')).toBe(true)
    expect(isCatalogWorkspace('yarn-workspace')).toBe(true)
    expect(isCatalogWorkspace('bun-workspace')).toBe(true)
    expect(isCatalogWorkspace('vlt-workspace')).toBe(true)
  })

  it('returns false for non-workspace dep types', () => {
    expect(isCatalogWorkspace('dependencies')).toBe(false)
  })
})

describe('isCatalogPackageName', () => {
  it('returns true for catalog package names', () => {
    expect(isCatalogPackageName('pnpm-catalog:default')).toBe(true)
    expect(isCatalogPackageName('yarn-catalog:lint')).toBe(true)
  })

  it('returns false for empty and non-catalog package names', () => {
    expect(isCatalogPackageName('')).toBe(false)
    expect(isCatalogPackageName('react')).toBe(false)
  })
})

describe('extractCatalogName', () => {
  it('extracts catalog segment from package names', () => {
    expect(extractCatalogName('pnpm-catalog:default')).toBe('default')
    expect(extractCatalogName('bun-catalog:test')).toBe('test')
  })

  it('returns input when no catalog prefix exists', () => {
    expect(extractCatalogName('react')).toBe('react')
  })
})

describe('isPnpmOverridesPackageName', () => {
  it('matches pnpm overrides package name exactly', () => {
    expect(isPnpmOverridesPackageName('pnpm-workspace:overrides')).toBe(true)
    expect(isPnpmOverridesPackageName('pnpm-catalog:default')).toBe(false)
    expect(isPnpmOverridesPackageName(undefined)).toBe(false)
  })
})

describe('hasEslint', () => {
  it('returns true when package.json deps contain eslint', () => {
    expect(hasEslint([
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
    ])).toBe(true)
  })

  it('returns false when only workspace packages contain eslint', () => {
    expect(hasEslint([
      {
        type: 'pnpm-workspace.yaml',
        name: 'pnpm-catalog:lint',
        private: true,
        version: '',
        filepath: '/repo/pnpm-workspace.yaml',
        relative: 'pnpm-workspace.yaml',
        raw: {},
        context: {},
        deps: [
          {
            name: 'eslint',
            specifier: '^9.0.0',
            source: 'pnpm-workspace',
            parents: [],
            catalogable: true,
            catalogName: 'lint',
            isCatalog: true,
          },
        ],
      },
    ])).toBe(false)
  })
})

describe('hasVSCodeEngine', () => {
  it('returns true when package.json engines.vscode exists', () => {
    expect(hasVSCodeEngine([
      {
        type: 'package.json',
        name: 'extension',
        private: true,
        version: '0.0.0',
        filepath: '/repo/package.json',
        relative: 'package.json',
        raw: {
          engines: {
            vscode: '^1.95.0',
          },
        },
        deps: [],
      },
    ])).toBe(true)
  })

  it('returns false when no package.json has engines.vscode', () => {
    expect(hasVSCodeEngine([
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
    ])).toBe(false)
  })
})
