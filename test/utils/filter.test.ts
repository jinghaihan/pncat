import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_OPTIONS } from '../../src/constants'
import { createDependenciesFilter, specFilter } from '../../src/utils'

describe('specFilter', () => {
  it('rejects blank specifier', () => {
    expect(specFilter('   ')).toBe(false)
  })

  it('accepts catalog protocol specifier', () => {
    expect(specFilter('catalog:test')).toBe(true)
  })

  it('rejects complex ranges by default', () => {
    expect(specFilter('1.0.0 || 2.0.0')).toBe(false)
    expect(specFilter('1.0.0 - 2.0.0')).toBe(false)
    expect(specFilter('>=18.0.0')).toBe(false)
    expect(specFilter('<=19.0.0')).toBe(false)
    expect(specFilter('>18.0.0')).toBe(false)
    expect(specFilter('<19.0.0')).toBe(false)
  })

  it('allows complex ranges when skipComplexRanges is false', () => {
    expect(specFilter('>=18.0.0', { skipComplexRanges: false })).toBe(true)
  })

  it('applies explicit skipRangeTypes checks', () => {
    expect(specFilter('1.x', { skipRangeTypes: ['x'] })).toBe(false)
    expect(specFilter('*', { skipRangeTypes: ['*'] })).toBe(false)
    expect(specFilter('1.2.3-beta.1', { skipRangeTypes: ['pre-release'] })).toBe(false)
    expect(specFilter('^1.2.3', { skipRangeTypes: ['x'] })).toBe(true)
  })

  it('rejects prerelease versions when allowPreReleases is false', () => {
    expect(specFilter('1.2.3-beta.1', { allowPreReleases: false })).toBe(false)
    expect(specFilter('1.2.3', { allowPreReleases: false })).toBe(true)
  })

  it('rejects wildcard ranges when allowWildcards is false', () => {
    expect(specFilter('1.x', { skipComplexRanges: false, allowWildcards: false })).toBe(false)
    expect(specFilter('*', { skipComplexRanges: false, allowWildcards: false })).toBe(false)
    expect(specFilter('1.*.0', { skipComplexRanges: false, allowWildcards: false })).toBe(false)
  })

  it('accepts wildcard ranges when allowWildcards is true', () => {
    expect(specFilter('1.x', { skipComplexRanges: false, allowWildcards: true })).toBe(true)
    expect(specFilter('*', { skipComplexRanges: false, allowWildcards: true })).toBe(true)
    expect(specFilter('1.*.0', { skipComplexRanges: false, allowWildcards: true })).toBe(true)
  })

  it('accepts npm alias with normal semver range', () => {
    expect(specFilter('npm:react@^18.3.1')).toBe(true)
    expect(specFilter('npm:@types/node@^22.0.0')).toBe(true)
  })

  it('rejects npm alias wildcard ranges when allowWildcards is false', () => {
    expect(specFilter('npm:react@1.x', { skipComplexRanges: false, allowWildcards: false })).toBe(false)
    expect(specFilter('npm:react@*', { skipComplexRanges: false, allowWildcards: false })).toBe(false)
  })

  it('accepts npm alias wildcard range when allowWildcards is true', () => {
    expect(specFilter('npm:react@1.x', { skipComplexRanges: false, allowWildcards: true })).toBe(true)
    expect(specFilter('npm:react@*', { skipComplexRanges: false, allowWildcards: true })).toBe(true)
  })

  it('applies complex range checks to npm alias range part', () => {
    expect(specFilter('npm:react@>=18.0.0')).toBe(false)
    expect(specFilter('npm:react@>=18.0.0', { skipComplexRanges: false })).toBe(true)
  })
})

describe('createDependenciesFilter', () => {
  it('supports comma-separated include values', () => {
    const filter = createDependenciesFilter('react,vue')

    expect(filter('react', '^18.3.1')).toBe(true)
    expect(filter('vue', '^3.5.0')).toBe(true)
    expect(filter('svelte', '^5.0.0')).toBe(false)
  })

  it('supports wildcard include and exclude values', () => {
    const filter = createDependenciesFilter(['@types/*'], ['@types/internal*'])

    expect(filter('@types/node', '^22.0.0')).toBe(true)
    expect(filter('@types/internal-utils', '^1.0.0')).toBe(false)
  })

  it('supports regex-literal include values', () => {
    const filter = createDependenciesFilter('/^vue$/')

    expect(filter('vue', '^3.5.0')).toBe(true)
    expect(filter('vue-router', '^4.5.0')).toBe(false)
  })

  it('treats plain include values as escaped string patterns', () => {
    const filter = createDependenciesFilter('eslint.+')

    expect(filter('eslint.+', '^9.0.0')).toBe(true)
    expect(filter('eslintx+', '^9.0.0')).toBe(false)
  })

  it('rejects specifiers with blocked protocols', () => {
    const filter = createDependenciesFilter([], [], DEFAULT_CATALOG_OPTIONS.allowedProtocols)
    expect(filter('react', 'workspace:*')).toBe(false)
    expect(filter('react', 'link:../pkg')).toBe(false)
    expect(filter('react', '^18.3.1')).toBe(true)
  })

  it('rejects invalid package names', () => {
    const filter = createDependenciesFilter()
    expect(filter('react@next', '^18.3.1')).toBe(false)
    expect(filter('@scope/pkg@next', '^1.0.0')).toBe(false)
    expect(filter('@scope/pkg', '^1.0.0')).toBe(true)
  })

  it('delegates range checks to specFilter options', () => {
    const strict = createDependenciesFilter()
    const filter = createDependenciesFilter(
      [],
      [],
      DEFAULT_CATALOG_OPTIONS.allowedProtocols,
      {
        skipComplexRanges: false,
        allowWildcards: true,
      },
    )

    expect(strict('react', '>=18.0.0')).toBe(false)
    expect(strict('react', 'catalog:test')).toBe(true)
    expect(filter('react', '>=18.0.0')).toBe(true)
    expect(filter('react', '1.x')).toBe(true)
  })
})
