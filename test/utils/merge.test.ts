import type { CatalogRule } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { mergeCatalogRules } from '../../src/utils'

describe('mergeCatalogRules', () => {
  it('merges with defaults by default', () => {
    const merged = mergeCatalogRules([
      {
        name: 'custom',
        match: ['my-lib'],
        priority: 5,
      },
    ])

    expect(merged.some(rule => rule.name === 'custom')).toBe(true)
    expect(merged.some(rule => rule.name === 'types')).toBe(true)
  })

  it('supports disabling default rules', () => {
    const merged = mergeCatalogRules(
      { mergeDefaults: false },
      [
        {
          name: 'custom',
          match: ['my-lib'],
        },
      ],
    )

    expect(merged).toEqual([
      {
        name: 'custom',
        match: ['my-lib'],
      },
    ])
  })

  it('merges rules with same name and sorts by priority', () => {
    const merged = mergeCatalogRules(
      { mergeDefaults: false },
      [
        {
          name: 'lint',
          match: [/eslint/],
          priority: 20,
        },
        {
          name: 'node',
          match: ['cac'],
          priority: 60,
        },
      ],
      [
        {
          name: 'lint',
          match: ['prettier'],
          priority: 10,
        },
      ],
    )

    const lint = merged.find(rule => rule.name === 'lint') as CatalogRule
    expect(Array.isArray(lint.match)).toBe(true)
    expect((lint.match as (string | RegExp)[]).map(item => item.toString())).toContain('prettier')
    expect((lint.match as (string | RegExp)[]).map(item => item.toString())).toContain('/eslint/')
    expect(merged[0].name).toBe('lint')
  })
})
