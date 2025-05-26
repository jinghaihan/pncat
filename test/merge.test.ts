import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_RULES, mergeCatalogRules } from '../src'

const length = DEFAULT_CATALOG_RULES.length

describe('merge catalog rules', () => {
  it('merge not existing name', () => {
    const rules = mergeCatalogRules([
      {
        name: 'inlined',
        match: ['@antfu/utils'],
      },
    ])
    expect(rules.length).toBe(length + 1)
  })

  it('merge existing name', () => {
    const rules = mergeCatalogRules([
      {
        name: 'script',
        match: ['@antfu/nip'],
        priority: 0,
      },
    ])
    expect(rules.length).toBe(length)

    const rule = rules.find(rule => rule.name === 'script')
    expect(rule?.priority).toBe(0)
  })

  it('not merget with default rules', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'frontend',
        match: ['vue'],
      },
      {
        name: 'frontend',
        match: ['react'],
      },
    ])
    expect(rules.length).toBe(1)
    expect(rules[0].match).toMatchInlineSnapshot(`
      [
        "vue",
        "react",
      ]
    `)
  })
})
