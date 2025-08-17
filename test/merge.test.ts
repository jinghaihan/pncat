import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_RULES } from '../src/rules'
import { mergeCatalogRules } from '../src/utils/merge'

describe('mergeCatalogRules', () => {
  it('add custom catalog rules', () => {
    const rules = mergeCatalogRules([
      {
        name: 'ui',
        match: ['antd'],
        priority: 50,
      },
    ])

    expect(rules.length).toBe(DEFAULT_CATALOG_RULES.length + 1)

    const rule = rules.find(r => r.name === 'ui')!
    expect(rule).toBeDefined()
    expect(rule.match).toEqual(['antd'])
    expect(rule.priority).toBe(50)
  })

  it('add custom package to existing catalog rule', () => {
    const rules = mergeCatalogRules([
      {
        name: 'frontend',
        match: ['antd'],
      },
    ])

    expect(rules.length).toBe(DEFAULT_CATALOG_RULES.length)

    const originRule = DEFAULT_CATALOG_RULES.find(r => r.name === 'frontend')!
    const rule = rules.find(r => r.name === 'frontend')!

    expect(rule.priority).toBe(originRule.priority)
    if (Array.isArray(rule.match) && Array.isArray(originRule.match)) {
      expect(rule.match.length).toBe(originRule.match.length + 1)
      expect(rule.match).toContain('antd')
    }
  })

  it('override existing catalog rule priority', () => {
    const rules = mergeCatalogRules([
      {
        name: 'frontend',
        match: ['antd'],
        priority: 0,
      },
    ])

    const rule = rules.find(r => r.name === 'frontend')!
    expect(rule.priority).toBe(0)
  })

  it('rules should sorted by priority', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'frontend',
        match: ['antd'],
        priority: 10,
      },
      {
        name: 'utils',
        match: ['lodash'],
        priority: 0,
      },
    ])

    expect(rules[0].name).toBe('utils')
    expect(rules[1].name).toBe('frontend')
  })

  it('merge multiple rules with same name from different sources', () => {
    const rules = mergeCatalogRules([
      {
        name: 'frontend',
        match: ['antd'],
      },
      {
        name: 'frontend',
        match: ['react'],
      },
    ])

    const rule = rules.find(r => r.name === 'frontend')!
    expect(rule.match).toContain('antd')
    expect(rule.match).toContain('react')
  })

  it('`depFields` should be merged', () => {
    const rules = mergeCatalogRules([
      {
        name: 'frontend',
        match: ['antd'],
        depFields: ['dependencies'],
      },
      {
        name: 'frontend',
        match: ['react'],
        depFields: ['devDependencies'],
      },
    ])

    const rule = rules.find(r => r.name === 'frontend')!
    expect(rule.depFields).toEqual(['dependencies', 'devDependencies'])
  })

  it('when `mergeDefaults` is false, merge same name rules', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'frontend',
        match: ['antd'],
      },
      {
        name: 'frontend',
        match: ['react'],
      },
    ])

    expect(rules.length).toBe(1)
    expect(rules[0].match).toEqual(['antd', 'react'])
  })

  it('different match patterns should be merge', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'frontend',
        match: ['antd'],
      },
      {
        name: 'frontend',
        match: 'react',
      },
    ])

    const rule = rules.find(r => r.name === 'frontend')!
    expect(rule.match).toEqual(['antd', 'react'])
  })

  it('`specifierRules` should be merged', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'frontend',
        match: ['antd'],
        specifierRules: [
          { specifier: '>=1.0.0', match: 'antd', suffix: 'v1' },
        ],
      },
      {
        name: 'frontend',
        match: ['react'],
        specifierRules: [
          { specifier: '>=2.0.0', match: 'react', suffix: 'v2' },
        ],
      },
    ])

    const rule = rules.find(r => r.name === 'frontend')!
    expect(rule.specifierRules?.length).toBe(2)
    expect(rule.specifierRules?.[0]).toEqual({ specifier: '>=1.0.0', match: 'antd', suffix: 'v1' })
    expect(rule.specifierRules?.[1]).toEqual({ specifier: '>=2.0.0', match: 'react', suffix: 'v2' })
  })
})
