import { describe, expect, it } from 'vitest'
import { createDependenciesFilter, specFilter } from '../src/utils/filter'

describe('specFilter', () => {
  it('valid specifiers should be accepted', () => {
    expect(specFilter('1.0.0', {})).toBe(true)
    expect(specFilter('^1.0.0', {})).toBe(true)
    expect(specFilter('~1.0.0', {})).toBe(true)
  })

  it('already is cataloged should be accepted', () => {
    expect(specFilter('catalog:frontend')).toBe(true)
  })

  it('empty and invalid specifiers', () => {
    expect(specFilter('')).toBe(false)
    expect(specFilter('   ', {})).toBe(false)
    expect(specFilter('\t\n', {})).toBe(false)
  })

  describe('skipComplexRanges', () => {
    it('or operator should be reject', () => {
      expect(specFilter('^1.0.0 || ^2.0.0', { skipComplexRanges: true })).toBe(false)
      expect(specFilter('^1.0.0 || ^2.0.0', { skipComplexRanges: false })).toBe(true)
    })

    it('hyphen range should be reject', () => {
      expect(specFilter('1.0.0 - 2.0.0', { skipComplexRanges: true })).toBe(false)
      expect(specFilter('1.0.0 - 2.0.0', { skipComplexRanges: false })).toBe(true)
    })

    it('comparison operators should be reject', () => {
      expect(specFilter('>=1.0.0', { skipComplexRanges: true })).toBe(false)
      expect(specFilter('<=1.0.0', { skipComplexRanges: true })).toBe(false)
      expect(specFilter('>1.0.0', { skipComplexRanges: true })).toBe(false)
      expect(specFilter('<1.0.0', { skipComplexRanges: true })).toBe(false)

      expect(specFilter('>=1.0.0', { skipComplexRanges: false })).toBe(true)
      expect(specFilter('<=1.0.0', { skipComplexRanges: false })).toBe(true)
      expect(specFilter('>1.0.0', { skipComplexRanges: false })).toBe(true)
      expect(specFilter('<1.0.0', { skipComplexRanges: false })).toBe(true)
    })
  })

  describe('allowPreReleases', () => {
    it('pre-release should be allowed', () => {
      expect(specFilter('1.0.0-alpha.1')).toBe(true)
      expect(specFilter('1.0.0-beta.1')).toBe(true)
      expect(specFilter('1.0.0.rc.1')).toBe(true)

      expect(specFilter('1.0.0-alpha.1', { allowPreReleases: false })).toBe(false)
      expect(specFilter('1.0.0-beta.1', { allowPreReleases: false })).toBe(false)
      expect(specFilter('1.0.0-rc.1', { allowPreReleases: false })).toBe(false)
    })

    describe('allowWildcards', () => {
      it('wildcard should be reject', () => {
        expect(specFilter('1.x')).toBe(false)
        expect(specFilter('*')).toBe(false)

        expect(specFilter('1.x', { allowWildcards: true })).toBe(true)
        expect(specFilter('*', { allowWildcards: true })).toBe(true)
      })
    })

    describe('skipRangeTypes', () => {
      it('custom range types should override `skipComplexRanges`', () => {
        expect(specFilter('^1.0.0 || ^2.0.0', { skipRangeTypes: ['-'] })).toBe(true)
        expect(specFilter('^1.0.0 || ^2.0.0', { skipRangeTypes: ['||'] })).toBe(false)

        expect(specFilter('1.0.0 - 2.0.0', { skipRangeTypes: ['||'] })).toBe(true)
        expect(specFilter('1.0.0 - 2.0.0', { skipRangeTypes: ['-'] })).toBe(false)

        expect(specFilter('>=1.0.0', { skipRangeTypes: ['>'] })).toBe(true)
        expect(specFilter('>=1.0.0', { skipRangeTypes: ['>='] })).toBe(false)

        expect(specFilter('<=1.0.0', { skipRangeTypes: ['<'] })).toBe(true)
        expect(specFilter('<=1.0.0', { skipRangeTypes: ['<='] })).toBe(false)

        expect(specFilter('>1.0.0', { skipRangeTypes: ['>='] })).toBe(true)
        expect(specFilter('>1.0.0', { skipRangeTypes: ['>'] })).toBe(false)

        expect(specFilter('<1.0.0', { skipRangeTypes: ['<='] })).toBe(true)
        expect(specFilter('<1.0.0', { skipRangeTypes: ['<'] })).toBe(false)
      })

      it('custom range types should override `allowPreReleases`', () => {
        expect(specFilter('1.0.0-alpha.1')).toBe(true)
        expect(specFilter('1.0.0-alpha.1', { skipRangeTypes: ['-'], allowPreReleases: true })).toBe(true)
        expect(specFilter('1.0.0-alpha.1', { skipRangeTypes: ['pre-release'], allowPreReleases: true })).toBe(false)
      })

      it('custom range types should override `allowWildcards`', () => {
        expect(specFilter('1.x')).toBe(false)
        expect(specFilter('1.x', { skipRangeTypes: ['*'], allowWildcards: true })).toBe(true)
        expect(specFilter('1.x', { skipRangeTypes: ['x'], allowWildcards: true })).toBe(false)

        expect(specFilter('*')).toBe(false)
        expect(specFilter('*', { skipRangeTypes: ['x'], allowWildcards: true })).toBe(true)
        expect(specFilter('*', { skipRangeTypes: ['*'], allowWildcards: true })).toBe(false)
      })
    })
  })
})

describe('createDependenciesFilter', () => {
  it('should filter correct dependencies', () => {
    const filter = createDependenciesFilter(
      ['vue'],
      ['react'],
      ['workspace', 'link', 'file'],
      {
        skipComplexRanges: true,
        allowPreReleases: true,
        allowWildcards: false,
      },
    )

    expect(filter('vue', '^1.0.0')).toBe(true)
    expect(filter('vue', '*')).toBe(false)
    expect(filter('vue', 'catalog:frontend')).toBe(true)

    expect(filter('react', '^1.0.0')).toBe(false)

    expect(filter('pncat', 'workspace:*')).toBe(false)
    expect(filter('pncat', 'link:/path/to/local-package')).toBe(false)
    expect(filter('pncat', 'file:/path/to/local-package')).toBe(false)
  })
})
