import { describe, expect, it } from 'vitest'
import { specifierFilter } from '../src/utils/filter'

describe('specifierFilter', () => {
  describe('empty and invalid specifiers', () => {
    it('should reject empty or whitespace-only specifiers', () => {
      expect(specifierFilter('', {})).toBe(false)
      expect(specifierFilter('   ', {})).toBe(false)
      expect(specifierFilter('\t\n', {})).toBe(false)
    })
  })

  describe('complex ranges when skipComplexRanges is true', () => {
    it('should reject logical OR ranges commonly used for compatibility', () => {
      // React compatibility across versions
      expect(specifierFilter('^16.8.0 || ^17.0.0 || ^18.0.0', { skipComplexRanges: true })).toBe(false)

      // Node.js version compatibility
      expect(specifierFilter('>=14.0.0 || >=16.0.0', { skipComplexRanges: true })).toBe(false)
    })

    it('should reject hyphen ranges used for version spans', () => {
      // TypeScript version range
      expect(specifierFilter('4.0.0 - 5.0.0', { skipComplexRanges: true })).toBe(false)

      // ESLint compatibility range
      expect(specifierFilter('8.0.0 - 9.0.0', { skipComplexRanges: true })).toBe(false)
    })

    it('should reject comparison operators', () => {
      // Minimum Node.js version
      expect(specifierFilter('>=18.0.0', { skipComplexRanges: true })).toBe(false)

      // Maximum version constraints
      expect(specifierFilter('<5.0.0', { skipComplexRanges: true })).toBe(false)

      expect(specifierFilter('<=4.9.0', { skipComplexRanges: true })).toBe(false)

      expect(specifierFilter('>2.0.0', { skipComplexRanges: true })).toBe(false)
    })

    it('should accept simple version patterns', () => {
      // Standard semantic versions
      expect(specifierFilter('^3.2.1', { skipComplexRanges: true })).toBe(true)

      expect(specifierFilter('~5.1.0', { skipComplexRanges: true })).toBe(true)

      expect(specifierFilter('1.2.3', { skipComplexRanges: true })).toBe(true)
    })
  })

  describe('complex ranges when skipComplexRanges is false', () => {
    it('should accept all range types when skipComplexRanges is disabled', () => {
      expect(specifierFilter('^16.0.0 || ^17.0.0', { skipComplexRanges: false })).toBe(true)

      expect(specifierFilter('>=14.0.0', { skipComplexRanges: false })).toBe(true)

      expect(specifierFilter('1.0.0 - 2.0.0', { skipComplexRanges: false })).toBe(true)
    })
  })

  describe('specific range types filtering', () => {
    it('should respect skipRangeTypes over skipComplexRanges', () => {
      // When skipRangeTypes is specified, skipComplexRanges is ignored
      expect(specifierFilter('^16.0.0 || ^17.0.0', {
        skipComplexRanges: true,
        skipRangeTypes: ['>'], // Only skip '>', but '||' should pass
      })).toBe(true)
    })

    it('should filter out OR ranges when specified', () => {
      expect(specifierFilter('^3.0.0 || ^4.0.0', { skipRangeTypes: ['||'] })).toBe(false)

      expect(specifierFilter('^3.0.0', { skipRangeTypes: ['||'] })).toBe(true)
    })

    it('should filter out hyphen ranges when specified', () => {
      expect(specifierFilter('1.2.3 - 2.0.0', { skipRangeTypes: ['-'] })).toBe(false)

      expect(specifierFilter('1.2.3', { skipRangeTypes: ['-'] })).toBe(true)
    })

    it('should filter out comparison operators when specified', () => {
      expect(specifierFilter('>=18.0.0', { skipRangeTypes: ['>='] })).toBe(false)

      expect(specifierFilter('>16.0.0', { skipRangeTypes: ['>'] })).toBe(false)

      expect(specifierFilter('<=4.0.0', { skipRangeTypes: ['<='] })).toBe(false)

      expect(specifierFilter('<5.0.0', { skipRangeTypes: ['<'] })).toBe(false)
    })

    it('should filter out wildcard patterns when specified', () => {
      expect(specifierFilter('3.x', { skipRangeTypes: ['x'] })).toBe(false)

      expect(specifierFilter('*', { skipRangeTypes: ['*'] })).toBe(false)

      expect(specifierFilter('3.2.1', { skipRangeTypes: ['x', '*'] })).toBe(true)
    })

    it('should filter out pre-release versions when specified', () => {
      expect(specifierFilter('4.0.0-beta.1', { skipRangeTypes: ['pre-release'] })).toBe(false)

      expect(specifierFilter('5.0.0-alpha.2', { skipRangeTypes: ['pre-release'] })).toBe(false)

      expect(specifierFilter('4.0.0', { skipRangeTypes: ['pre-release'] })).toBe(true)
    })
  })

  describe('pre-release versions', () => {
    it('should reject pre-release versions when allowPreReleases is false', () => {
      // Vue 3 beta versions
      expect(specifierFilter('3.0.0-beta.1', { allowPreReleases: false })).toBe(false)

      // React alpha versions
      expect(specifierFilter('18.0.0-alpha.0', { allowPreReleases: false })).toBe(false)

      // TypeScript RC versions
      expect(specifierFilter('5.0.0-rc.1', { allowPreReleases: false })).toBe(false)
    })

    it('should accept pre-release versions when allowPreReleases is true', () => {
      expect(specifierFilter('3.0.0-beta.1', { allowPreReleases: true })).toBe(true)

      expect(specifierFilter('18.0.0-alpha.0', { allowPreReleases: true })).toBe(true)
    })

    it('should accept stable versions regardless of allowPreReleases setting', () => {
      expect(specifierFilter('3.2.1', { allowPreReleases: false })).toBe(true)

      expect(specifierFilter('18.2.0', { allowPreReleases: true })).toBe(true)
    })
  })

  describe('wildcard versions', () => {
    it('should reject wildcard versions when allowWildcards is false', () => {
      // Common wildcard patterns
      expect(specifierFilter('3.x', { allowWildcards: false })).toBe(false)

      expect(specifierFilter('*', { allowWildcards: false })).toBe(false)

      expect(specifierFilter('2.x.x', { allowWildcards: false })).toBe(false)
    })

    it('should accept wildcard versions when allowWildcards is true', () => {
      expect(specifierFilter('3.x', { allowWildcards: true })).toBe(true)

      expect(specifierFilter('*', { allowWildcards: true })).toBe(true)
    })

    it('should accept specific versions regardless of allowWildcards setting', () => {
      expect(specifierFilter('3.2.1', { allowWildcards: false })).toBe(true)

      expect(specifierFilter('18.2.0', { allowWildcards: true })).toBe(true)
    })
  })

  describe('catalog specifiers', () => {
    it('should accept catalog specifiers', () => {
      expect(specifierFilter('catalog:')).toBe(true)
      expect(specifierFilter('catalog:frontend')).toBe(true)
    })
  })
})
