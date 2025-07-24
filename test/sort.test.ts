import type { CatalogRule } from '../src/types'
import { describe, expect, it } from 'vitest'
import { sortCatalogRules } from '../src/utils/sort'

describe('sortCatalogRules', () => {
  it('should sort catalog rules by priority in ascending order', () => {
    const rules: CatalogRule[] = [
      {
        name: 'frontend',
        match: [/^vue$/, /vue-router/, /element-plus/, /ant-design/],
        priority: 60,
      },
      {
        name: 'types',
        match: [/@types\//],
        priority: 10,
      },
      {
        name: 'test',
        match: [/vitest/, /jest/, /cypress/, /playwright/],
        priority: 20,
      },
      {
        name: 'utils',
        match: [/lodash/, /dayjs/, /semver/, /chalk/],
        priority: 30,
      },
    ]

    const sorted = sortCatalogRules(rules)

    expect(sorted.map(r => r.name)).toEqual([
      'types',
      'test',
      'utils',
      'frontend',
    ])
  })

  it('should handle rules without priority (default to Infinity)', () => {
    const rules: CatalogRule[] = [
      {
        name: 'lint',
        match: [/eslint/, /prettier/, /stylelint/],
        priority: 20,
      },
      {
        name: 'database',
        match: ['mysql2', 'pg', 'prisma'],
        // no priority - should default to Infinity
      },
      {
        name: 'build',
        match: [/vite/, /webpack/, /rollup/],
        priority: 40,
      },
    ]

    const sorted = sortCatalogRules(rules)

    expect(sorted.map(r => r.name)).toEqual([
      'lint',
      'build',
      'database', // should be last due to Infinity priority
    ])
  })

  it('should handle zero and negative priorities', () => {
    const rules: CatalogRule[] = [
      {
        name: 'polyfills',
        match: ['core-js', 'regenerator-runtime'],
        priority: -10, // negative priority for critical early loading
      },
      {
        name: 'types',
        match: [/@types\//],
        priority: 0,
      },
      {
        name: 'optional',
        match: ['debug', 'source-map-support'],
        priority: 100,
      },
    ]

    const sorted = sortCatalogRules(rules)

    expect(sorted.map(r => r.name)).toEqual([
      'polyfills',
      'types',
      'optional',
    ])
  })

  it('should maintain stable sort for same priority values', () => {
    const rules: CatalogRule[] = [
      {
        name: 'eslint',
        match: [/^eslint$/],
        priority: 20,
      },
      {
        name: 'prettier',
        match: [/prettier/],
        priority: 20,
      },
      {
        name: 'husky',
        match: [/husky/, /lint-staged/],
        priority: 20,
      },
    ]

    const sorted = sortCatalogRules(rules)

    // Original order should be maintained for same priority
    expect(sorted.map(r => r.name)).toEqual([
      'eslint',
      'prettier',
      'husky',
    ])
  })

  it('should work with empty array', () => {
    const rules: CatalogRule[] = []
    const sorted = sortCatalogRules(rules)
    expect(sorted).toEqual([])
  })
})
