import { describe, expect, it } from 'vitest'
import { specifierFilter } from '../src/utils/filter'

describe('specifier filter', () => {
  it('skip complex specifier ranges', () => {
    const result = specifierFilter('1.0.0 || 2.0.0', {
      skipComplexRanges: true,
    })
    expect(result).toBe(false)
  })

  it('skip specified range types', () => {
    const result = specifierFilter('1.0.0 || 2.0.0', {
      skipComplexRanges: true,
      skipRangeTypes: ['>'],
    })
    expect(result).toBe(true)
  })

  it('allow pre releases specifier', () => {
    expect(specifierFilter('1.0.0-beta', {
      allowPreReleases: false,
    })).toBe(false)

    expect(specifierFilter('1.0.0-beta', {
      allowPreReleases: true,
    })).toBe(true)
  })

  it('allow wildcards specifier', () => {
    expect(specifierFilter('3.x', {
      allowWildcards: false,
    })).toBe(false)

    expect(specifierFilter('3.x', {
      allowWildcards: true,
    })).toBe(true)
  })
})
