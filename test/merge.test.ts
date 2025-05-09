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
      },
    ])
    expect(rules.length).toBe(length)
  })

  it('not merget with default rules', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'inlined',
        match: ['@antfu/utils'],
      },
    ])
    expect(rules.length).toBe(1)
  })

  it('no priority', async () => {
    const rules = mergeCatalogRules([
      {
        name: 'inlined',
        match: ['@antfu/utils'],
      },
    ])
    expect(rules[rules.length - 1].name).toBe('inlined')
  })

  it('min priority', async () => {
    const rules = mergeCatalogRules([
      {
        name: 'inlined',
        match: ['@antfu/utils'],
        priority: 0,
      },
    ])
    expect(rules[0].name).toBe('inlined')
  })

  it('max priority', async () => {
    const rules = mergeCatalogRules([
      {
        name: 'inlined',
        match: ['@antfu/utils'],
        priority: 1000,
      },
    ])
    expect(rules[rules.length - 1].name).toBe('inlined')
  })
})
