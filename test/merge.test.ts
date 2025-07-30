import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_RULES, mergeCatalogRules } from '../src'

const length = DEFAULT_CATALOG_RULES.length

describe('mergeCatalogRules', () => {
  it('add new custom catalog rule', () => {
    const rules = mergeCatalogRules([
      {
        name: 'ui',
        match: ['antd', 'element-plus', '@arco-design/web-react'],
        priority: 50,
      },
    ])

    expect(rules.length).toBe(length + 1)
    const customRule = rules.find(r => r.name === 'ui')
    expect(customRule).toBeDefined()
    expect(customRule?.match).toEqual(['antd', 'element-plus', '@arco-design/web-react'])
    expect(customRule?.priority).toBe(50)
  })

  it('override existing default rule with custom packages', () => {
    const rules = mergeCatalogRules([
      {
        name: 'test',
        match: ['@testing-library/react', '@testing-library/vue'],
        priority: 15,
      },
    ])

    expect(rules.length).toBe(length)
    const testRule = rules.find(r => r.name === 'test')
    expect(testRule?.priority).toBe(15)
    // Should contain the new packages
    expect(Array.isArray(testRule?.match)).toBe(true)
    if (Array.isArray(testRule?.match)) {
      expect(testRule.match).toContain('@testing-library/react')
      expect(testRule.match).toContain('@testing-library/vue')
    }
  })

  it('merge multiple rules with same name from different sources', () => {
    const rules = mergeCatalogRules([
      {
        name: 'database',
        match: ['mysql2', 'pg'],
        depFields: ['dependencies'],
      },
      {
        name: 'database',
        match: ['@types/mysql2', '@types/pg'],
        depFields: ['devDependencies'],
      },
    ])

    const dbRule = rules.find(r => r.name === 'database')
    expect(dbRule).toBeDefined()
    // Match arrays are merged, not overwritten
    expect(dbRule?.match).toEqual(['mysql2', 'pg', '@types/mysql2', '@types/pg'])
    // depFields should be merged
    expect(dbRule?.depFields).toEqual(['dependencies', 'devDependencies'])
  })

  it('work without default rules when mergeDefaults is false', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'react',
        match: ['react', 'react-dom', 'react-router-dom'],
        priority: 10,
      },
      {
        name: 'vue',
        match: ['vue', 'vue-router', 'pinia'],
        priority: 10,
      },
    ])

    expect(rules.length).toBe(2)
    expect(rules.find(r => r.name === 'react')).toBeDefined()
    expect(rules.find(r => r.name === 'vue')).toBeDefined()
    // Should not contain any default rules
    expect(rules.find(r => r.name === 'types')).toBeUndefined()
  })

  it('handle empty input gracefully', () => {
    const rules = mergeCatalogRules([])
    expect(rules.length).toBe(length)

    const emptyRules = mergeCatalogRules({ mergeDefaults: false })
    expect(emptyRules).toEqual([])
  })

  it('preserve all rule properties during merge', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'build',
        match: ['webpack', 'rollup'],
        priority: 30,
        depFields: ['devDependencies'],
      },
      {
        name: 'build',
        match: ['vite', 'esbuild'],
        priority: 25,
        depFields: ['dependencies'],
      },
    ])

    const buildRule = rules.find(r => r.name === 'build')
    expect(buildRule).toEqual({
      name: 'build',
      match: ['webpack', 'rollup', 'vite', 'esbuild'],
      priority: 25,
      depFields: ['devDependencies', 'dependencies'],
    })
  })

  it('handle different match pattern types in real scenarios', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'typescript',
        match: 'typescript', // exact string match
        priority: 40,
      },
      {
        name: 'babel',
        match: /^@babel\//, // regex pattern
        priority: 40,
      },
      {
        name: 'testing',
        match: ['@testing-library/react', /@testing-library\/react/, 'react-test-renderer'], // mixed array
        priority: 20,
      },
    ])

    expect(rules.length).toBe(3)
    expect(rules[0].match).toBe('typescript')
    expect(rules[1].match).toEqual(/^@babel\//)
    expect(rules[2].match).toEqual(['@testing-library/react', /@testing-library\/react/, 'react-test-renderer'])
  })

  it('extend existing lint rule with project-specific tools', () => {
    const originalLintRule = DEFAULT_CATALOG_RULES.find(r => r.name === 'lint')
    expect(originalLintRule).toBeDefined()

    const rules = mergeCatalogRules([
      {
        name: 'lint',
        match: ['@typescript-eslint/parser', '@typescript-eslint/eslint-plugin'],
        priority: 15, // higher priority than default
      },
    ])

    const lintRule = rules.find(r => r.name === 'lint')
    expect(lintRule?.priority).toBe(15)
    expect(Array.isArray(lintRule?.match)).toBe(true)
    if (Array.isArray(lintRule?.match)) {
      expect(lintRule.match).toContain('@typescript-eslint/parser')
      expect(lintRule.match).toContain('@typescript-eslint/eslint-plugin')
    }
  })

  it('handle complex monorepo scenario with multiple catalog sources', () => {
    const rules = mergeCatalogRules(
      { mergeDefaults: false },
      // Frontend packages
      [
        {
          name: 'frontend',
          match: ['react', 'vue'],
          priority: 60,
        },
      ],
      // Backend packages
      [
        {
          name: 'backend',
          match: ['express', 'fastify'],
          priority: 70,
        },
      ],
      // Shared utilities
      [
        {
          name: 'utils',
          match: ['lodash', 'dayjs'],
          priority: 30,
        },
        // Override frontend with more packages
        {
          name: 'frontend',
          match: ['@ant-design/icons', 'styled-components'],
          depFields: ['dependencies'],
        },
      ],
    )

    expect(rules.length).toBe(3)

    const frontendRule = rules.find(r => r.name === 'frontend')
    expect(frontendRule?.match).toEqual(['react', 'vue', '@ant-design/icons', 'styled-components'])
    expect(frontendRule?.priority).toBe(60)
    expect(frontendRule?.depFields).toEqual(['dependencies'])

    const backendRule = rules.find(r => r.name === 'backend')
    expect(backendRule?.match).toEqual(['express', 'fastify'])

    const utilsRule = rules.find(r => r.name === 'utils')
    expect(utilsRule?.match).toEqual(['lodash', 'dayjs'])
  })

  it('merge specifierRules correctly when merging rules with same name', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'react',
        match: ['react', 'react-dom'],
        priority: 60,
        specifierRules: [
          {
            specifier: '>=18.0.0',
            match: 'react',
            name: 'react-v18',
            suffix: 'v18',
          },
          {
            specifier: '>=16.0.0 <18.0.0',
            match: 'react',
            name: 'react-v16',
            suffix: 'v16',
          },
        ],
      },
      {
        name: 'react',
        match: ['react-router', 'react-query'],
        specifierRules: [
          {
            specifier: '>=6.0.0',
            match: 'react-router',
            name: 'react-router-v6',
            suffix: 'v6',
          },
        ],
      },
    ])

    const reactRule = rules.find(r => r.name === 'react')
    expect(reactRule).toBeDefined()
    expect(reactRule?.match).toEqual(['react', 'react-dom', 'react-router', 'react-query'])
    expect(reactRule?.priority).toBe(60)
    expect(reactRule?.specifierRules).toHaveLength(3)

    // Check that specifierRules are merged correctly
    const specifierRules = reactRule?.specifierRules
    expect(specifierRules).toContainEqual({
      specifier: '>=18.0.0',
      match: 'react',
      name: 'react-v18',
      suffix: 'v18',
    })
    expect(specifierRules).toContainEqual({
      specifier: '>=16.0.0 <18.0.0',
      match: 'react',
      name: 'react-v16',
      suffix: 'v16',
    })
    expect(specifierRules).toContainEqual({
      specifier: '>=6.0.0',
      match: 'react-router',
      name: 'react-router-v6',
      suffix: 'v6',
    })
  })

  it('merge specifierRules with complex match patterns', () => {
    const rules = mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'typescript',
        match: ['typescript', '@types/node'],
        specifierRules: [
          {
            specifier: '>=5.0.0',
            match: /^typescript/,
            name: 'typescript-v5',
            suffix: 'v5',
          },
          {
            specifier: '>=4.0.0 <5.0.0',
            match: ['typescript', '@types/node'],
            name: 'typescript-v4',
            suffix: 'v4',
          },
        ],
      },
      {
        name: 'typescript',
        match: ['@types/react', '@types/react-dom'],
        specifierRules: [
          {
            specifier: '>=18.0.0',
            match: /@types\/react/,
            name: 'react-types-v18',
            suffix: 'v18',
          },
        ],
      },
    ])

    const tsRule = rules.find(r => r.name === 'typescript')
    expect(tsRule?.specifierRules).toHaveLength(3)

    // Check regex pattern is preserved
    const regexRule = tsRule?.specifierRules?.find(r => r.name === 'typescript-v5')
    expect(regexRule?.match).toEqual(/^typescript/)

    // Check array pattern is preserved
    const arrayRule = tsRule?.specifierRules?.find(r => r.name === 'typescript-v4')
    expect(arrayRule?.match).toEqual(['typescript', '@types/node'])

    // Check new rule is added
    const reactTypesRule = tsRule?.specifierRules?.find(r => r.name === 'react-types-v18')
    expect(reactTypesRule?.match).toEqual(/@types\/react/)
  })
})
