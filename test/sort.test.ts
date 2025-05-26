import { expect, it } from 'vitest'
import { mergeCatalogRules } from '../src/utils/merge'
import { sortCatalogRules } from '../src/utils/sort'

it('sort catalog rules', () => {
  const merged = mergeCatalogRules([
    {
      name: 'vue',
      match: ['vue'],
      priority: 0,
    },
    {
      name: 'angular',
      match: ['angular'],
    },
    {
      name: 'react',
      match: ['react'],
      priority: 1000,
    },
  ])

  const sorted = sortCatalogRules(merged)

  expect(sorted[0].name).toBe('vue')
  expect(sorted[sorted.length - 2].name).toBe('react')
  expect(sorted[sorted.length - 1].name).toBe('angular')
})
