import type { CatalogOptions, RawDep, WorkspaceSchema } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { createDepCatalogIndex, inferCatalogName, parseCatalogSpecifier, toCatalogSpecifier } from '../../src/utils'
import { createFixtureOptions } from '../_shared'

function createDep(overrides: Partial<Omit<RawDep, 'catalogName'>> = {}): Omit<RawDep, 'catalogName'> {
  return {
    name: 'react',
    specifier: '^18.3.1',
    source: 'dependencies',
    parents: [],
    catalogable: true,
    isCatalog: false,
    ...overrides,
  }
}

describe('createDepCatalogIndex', () => {
  it('returns empty map when workspace config is missing', () => {
    const index = createDepCatalogIndex()
    expect(index.size).toBe(0)
  })

  it('merges default and named catalogs', () => {
    const workspaceJson: WorkspaceSchema = {
      catalog: {
        react: '^18.3.1',
      },
      catalogs: {
        ui: {
          react: '^19.0.0',
          vue: '^3.5.0',
        },
      },
    }

    const index = createDepCatalogIndex(workspaceJson)
    expect(index.get('react')).toEqual([
      { catalogName: 'default', specifier: '^18.3.1' },
      { catalogName: 'ui', specifier: '^19.0.0' },
    ])
    expect(index.get('vue')).toEqual([
      { catalogName: 'ui', specifier: '^3.5.0' },
    ])
  })

  it('skips falsy named catalog values', () => {
    const workspaceJson = JSON.parse('{"catalogs":{"legacy":null}}')

    const index = createDepCatalogIndex(workspaceJson)
    expect(index.size).toBe(0)
  })
})

describe('inferCatalogName', () => {
  it('falls back to source map when no catalog rule matches', () => {
    const dep = createDep({ source: 'devDependencies' })
    expect(inferCatalogName(dep, createFixtureOptions())).toBe('dev')
  })

  it('uses rule name when dependency name matches', () => {
    const dep = createDep({ name: '@types/node' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'types',
          match: '@types/node',
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('types')
  })

  it('supports array and regexp matchers', () => {
    const dep = createDep({ name: 'eslint' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'lint',
          match: [/^eslint$/, 'prettier'],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('lint')
  })

  it('returns parent rule name when version cannot be cleaned', () => {
    const dep = createDep({ specifier: 'workspace:*' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'local',
          match: 'react',
          specifierRules: [
            { specifier: '^18.0.0', suffix: 'v18' },
          ],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('local')
  })

  it('returns parent rule name when no specifier rule matches', () => {
    const dep = createDep({ specifier: '^20.0.0' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'react',
          match: 'react',
          specifierRules: [
            { specifier: '^18.0.0', suffix: 'v18' },
          ],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('react')
  })

  it('uses single matching specifier rule name when present', () => {
    const dep = createDep({ specifier: '^18.3.0' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'react',
          match: 'react',
          specifierRules: [
            { specifier: '^18.0.0', name: 'react-stable', suffix: 'v18' },
          ],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('react-stable')
  })

  it('uses suffix when single matching specifier rule has no name', () => {
    const dep = createDep({ specifier: '^18.3.0' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'react',
          match: 'react',
          specifierRules: [
            { specifier: '^18.0.0', suffix: 'stable' },
          ],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('react-stable')
  })

  it('picks the most specific specifier rule when multiple rules match', () => {
    const dep = createDep({ specifier: '^18.3.0' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'react',
          match: 'react',
          specifierRules: [
            { specifier: '^18.0.0', suffix: 'broad' },
            { specifier: '^18.3.0', suffix: 'narrow' },
          ],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('react-narrow')
  })

  it('respects specifier rule match constraints', () => {
    const dep = createDep({ name: 'react-dom', specifier: '^18.3.0' })
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [
        {
          name: 'react',
          match: [/^react/, 'vue'],
          specifierRules: [
            { specifier: '^18.0.0', match: /^react-dom$/, suffix: 'dom' },
            { specifier: '^18.0.0', match: /^react$/, suffix: 'core' },
          ],
        },
      ],
    })

    expect(inferCatalogName(dep, options)).toBe('react-dom')
  })

  it('ignores invalid rule match types and falls back to source catalog name', () => {
    const dep = createDep({ source: 'dependencies' })
    const invalidRule = JSON.parse('{"name":"invalid","match":123}')
    const options: CatalogOptions = createFixtureOptions('pnpm', {
      catalogRules: [invalidRule],
    })

    expect(inferCatalogName(dep, options)).toBe('prod')
  })
})

describe('toCatalogSpecifier', () => {
  it('maps default catalog name to catalog protocol root', () => {
    expect(toCatalogSpecifier('default')).toBe('catalog:')
  })

  it('maps named catalog to namespaced catalog protocol', () => {
    expect(toCatalogSpecifier('build')).toBe('catalog:build')
  })
})

describe('parseCatalogSpecifier', () => {
  it('parses default catalog specifier', () => {
    expect(parseCatalogSpecifier('catalog:')).toBe('default')
  })

  it('parses named catalog specifier', () => {
    expect(parseCatalogSpecifier('catalog:build')).toBe('build')
  })
})
