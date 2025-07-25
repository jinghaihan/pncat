import type { CatalogOptions, RawDep } from '../src/types'
import { beforeAll, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config'
import { mergeCatalogRules } from '../src/utils/merge'
import { getDepCatalogName } from '../src/utils/rule'
import { sortCatalogRules } from '../src/utils/sort'

describe('getDepCatalogName', () => {
  let defaultConfig: CatalogOptions

  // Helper function to create RawDep with minimal required fields
  function createDep(name: string, source: RawDep['source'] = 'dependencies', specifier: string = '^1.0.0'): RawDep {
    return {
      name,
      specifier,
      source,
      catalog: true,
    }
  }

  // Helper function to test category mapping
  function expectCategory(packages: string[], expectedCategory: string, source: RawDep['source'] = 'dependencies', config: CatalogOptions = defaultConfig) {
    packages.forEach((pkg) => {
      expect(getDepCatalogName(createDep(pkg, source), config)).toBe(expectedCategory)
    })
  }

  beforeAll(async () => {
    defaultConfig = await resolveConfig({})
  })

  it('categorize by priority order', () => {
    // Types (priority 10) - highest priority
    expectCategory(['@types/node', '@types/react', '@types/express'], 'types', 'devDependencies')

    // Test/Lint/Monorepo/CLI (priority 20)
    expectCategory(['vitest', 'jest', 'cypress', 'playwright'], 'test', 'devDependencies')
    expectCategory(['eslint', 'prettier', 'stylelint', 'husky', 'lint-staged'], 'lint', 'devDependencies')
    expectCategory(['lerna', 'nx', '@changesets/cli'], 'monorepo', 'devDependencies')
    expectCategory(['bumpp', 'taze', 'commitizen'], 'cli', 'devDependencies')

    // Utils/Node/Network/I18n (priority 30)
    expectCategory(['lodash', 'dayjs', 'zod', '@vueuse/core'], 'utils')
    expectCategory(['fs-extra', 'chalk', 'cross-env', 'execa'], 'node')
    expectCategory(['axios'], 'network')
    expectCategory(['vue-i18n', 'react-i18next'], 'i18n')

    // Script/Build (priority 40)
    expectCategory(['tsx', 'jiti', 'esno'], 'script', 'devDependencies')
    expectCategory(['vite', 'webpack', 'rollup', 'esbuild'], 'build', 'devDependencies')

    // Icons/Style/Syntax/Markdown (priority 50)
    expectCategory(['@iconify/json', '@iconify-json/carbon'], 'icons')
    expectCategory(['tailwindcss', 'unocss', 'postcss'], 'style', 'devDependencies')
    expectCategory(['shiki', 'prismjs'], 'syntax')
    expectCategory(['markdown-it'], 'markdown')

    // Frontend (priority 60) - note: react is not in default frontend rules, only vue
    expectCategory(['vue', 'vue-router', 'pinia', 'element-plus', 'ant-design-vue'], 'frontend')

    // Backend (priority 70)
    expectCategory(['express', 'koa', 'drizzle-orm'], 'backend')
  })

  it('handle regex patterns correctly', () => {
    // Test various regex patterns from default rules
    expectCategory(['eslint-config-airbnb', 'eslint-plugin-vue'], 'lint', 'devDependencies')
    expectCategory(['vite-plugin-vue', 'webpack-bundle-analyzer'], 'build', 'devDependencies')
    expectCategory(['@vueuse/core', '@vueuse/head'], 'utils')
    expectCategory(['vue-i18n', 'react-i18next'], 'i18n')
  })

  it('fallback to default group names when no rule matches', () => {
    expect(getDepCatalogName(createDep('some-unknown-package', 'dependencies'), defaultConfig)).toBe('prod')
    expect(getDepCatalogName(createDep('another-unknown-lib', 'devDependencies'), defaultConfig)).toBe('dev')
    expect(getDepCatalogName(createDep('peer-dependency', 'peerDependencies'), defaultConfig)).toBe('peer')
    expect(getDepCatalogName(createDep('optional-dep', 'optionalDependencies'), defaultConfig)).toBe('optional')
  })

  it('work with custom catalog rules for database packages', () => {
    const customConfig: CatalogOptions = {
      ...defaultConfig,
      catalogRules: sortCatalogRules(mergeCatalogRules([
        {
          name: 'database',
          match: ['mysql2', 'pg', 'mongodb', 'sqlite3'],
          priority: 15,
        },
        {
          name: 'orm',
          match: ['prisma', 'typeorm', 'sequelize'],
          priority: 25,
        },
      ])),
    }

    // Custom database rules should work
    expectCategory(['mysql2', 'pg', 'mongodb'], 'database', 'dependencies', customConfig)
    expectCategory(['prisma', 'typeorm'], 'orm', 'dependencies', customConfig)

    // Default rules should still work
    expectCategory(['vue', 'element-plus'], 'frontend', 'dependencies', customConfig)
    expectCategory(['@types/node'], 'types', 'devDependencies', customConfig)
  })

  it('handle React ecosystem with mixed match patterns', () => {
    const config: CatalogOptions = {
      ...defaultConfig,
      catalogRules: sortCatalogRules(mergeCatalogRules([
        {
          name: 'react',
          match: ['react', 'react-dom', /^react-/, /@react-/],
          priority: 65, // Lower priority than types (10), so @types/react will still be 'types'
        },
      ])),
    }

    expectCategory(['react', 'react-dom'], 'react', 'dependencies', config) // exact string match
    expectCategory(['react-router-dom', 'react-query'], 'react', 'dependencies', config) // regex match
    expectCategory(['@react-spring/web', '@react-aria/button'], 'react', 'dependencies', config) // scoped regex match

    // @types/react still matches types rule (priority 10) because it has higher priority
    expectCategory(['@types/react', '@types/react-dom'], 'types', 'devDependencies', config)
  })

  it('respect rule priority with real UI framework conflict', () => {
    // Simulate a scenario where someone wants to categorize specific antd packages
    // but @ant-design/icons contains 'icon' so it matches icons rule (priority 50)
    const config: CatalogOptions = {
      ...defaultConfig,
      catalogRules: sortCatalogRules(mergeCatalogRules([
        {
          name: 'antd',
          match: ['antd', '@ant-design/colors', '@ant-design/pro-components'], // avoid packages with 'icon'
          priority: 45, // Higher priority than icons (50)
        },
      ])),
    }

    // These should match the higher priority antd rule
    expectCategory(['antd', '@ant-design/colors'], 'antd', 'dependencies', config)

    // @ant-design/icons still matches icons rule because it contains 'icon'
    expectCategory(['@ant-design/icons'], 'icons', 'dependencies', config)

    // Other frontend packages should still match frontend
    expectCategory(['element-plus', 'naive-ui'], 'frontend', 'dependencies', config)
  })

  describe('specifier rules', () => {
    it('should split Vue 2/3 by specifier rules using suffix', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'vue',
            match: ['vue'],
            priority: 10,
            specifierRules: [
              { specifier: '>=3.0.0', suffix: 'v3' },
              { specifier: '<3.0.0', suffix: 'v2' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('vue', 'dependencies', '^3.2.47'), config)).toBe('vue-v3')
      expect(getDepCatalogName(createDep('vue', 'dependencies', '^2.6.14'), config)).toBe('vue-v2')
    })

    it('should split React ecosystem by specifier rules using custom names', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'react',
            match: ['react', 'react-dom', '@types/react'],
            priority: 10,
            specifierRules: [
              { specifier: '>=18.0.0', name: 'react-modern' },
              { specifier: '>=16.8.0 <18.0.0', name: 'react-hooks' },
              { specifier: '<16.8.0', name: 'react-legacy' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('react', 'dependencies', '^18.2.0'), config)).toBe('react-modern')
      expect(getDepCatalogName(createDep('react-dom', 'dependencies', '^17.0.2'), config)).toBe('react-hooks')
      expect(getDepCatalogName(createDep('react', 'dependencies', '^16.7.0'), config)).toBe('react-legacy')
      expect(getDepCatalogName(createDep('@types/react', 'devDependencies', '^18.0.0'), config)).toBe('react-modern')
    })

    it('should handle Node.js versions for tools and runtimes', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'nodejs',
            match: ['@types/node', 'node'],
            priority: 10,
            specifierRules: [
              { specifier: '>=20.0.0', suffix: 'lts' },
              { specifier: '>=18.0.0 <20.0.0', suffix: 'stable' },
              { specifier: '<18.0.0', suffix: 'legacy' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('@types/node', 'devDependencies', '^20.10.0'), config)).toBe('nodejs-lts')
      expect(getDepCatalogName(createDep('@types/node', 'devDependencies', '^18.17.0'), config)).toBe('nodejs-stable')
      expect(getDepCatalogName(createDep('@types/node', 'devDependencies', '^16.18.0'), config)).toBe('nodejs-legacy')
    })

    it('should fallback to rule name when no specifier rules match', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'vue',
            match: ['vue'],
            priority: 10,
            specifierRules: [
              { specifier: '>=3.0.0', suffix: 'v3' },
              // No rule for <3.0.0
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('vue', 'dependencies', '^3.2.47'), config)).toBe('vue-v3')
      expect(getDepCatalogName(createDep('vue', 'dependencies', '^2.6.14'), config)).toBe('vue') // fallback
    })

    it('should fallback to rule name when version cannot be extracted', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'vue',
            match: ['vue'],
            priority: 10,
            specifierRules: [
              { specifier: '>=3.0.0', suffix: 'v3' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('vue', 'dependencies', 'workspace:*'), config)).toBe('vue')
      expect(getDepCatalogName(createDep('vue', 'dependencies', 'latest'), config)).toBe('vue')
      expect(getDepCatalogName(createDep('vue', 'dependencies', 'file:../vue'), config)).toBe('vue')
    })

    it('should handle TypeScript versions for tooling compatibility', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'typescript',
            match: ['typescript', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin'],
            priority: 10,
            specifierRules: [
              { specifier: '>=5.0.0', suffix: 'modern' },
              { specifier: '>=4.0.0 <5.0.0', suffix: 'stable' },
              { specifier: '<4.0.0', suffix: 'legacy' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('typescript', 'devDependencies', '^5.2.0'), config)).toBe('typescript-modern')
      expect(getDepCatalogName(createDep('@typescript-eslint/parser', 'devDependencies', '^4.33.0'), config)).toBe('typescript-stable')
      expect(getDepCatalogName(createDep('typescript', 'devDependencies', '^3.9.0'), config)).toBe('typescript-legacy')
    })

    it('should prioritize name over suffix when both are provided', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'eslint',
            match: ['eslint', 'eslint-config-airbnb'],
            priority: 10,
            specifierRules: [
              { specifier: '>=8.0.0', name: 'eslint-flat-config', suffix: 'v8' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('eslint', 'devDependencies', '^8.50.0'), config)).toBe('eslint-flat-config')
    })

    it('should handle overlapping specifier ranges with different specificity', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'webpack',
            match: ['webpack', 'webpack-cli'],
            priority: 10,
            specifierRules: [
              { specifier: '>=5.0.0 <5.50.0', suffix: 'modern' }, // Non-overlapping ranges
              { specifier: '>=5.50.0', suffix: 'latest' },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('webpack', 'devDependencies', '^5.30.0'), config)).toBe('webpack-modern')
      expect(getDepCatalogName(createDep('webpack', 'devDependencies', '^5.80.0'), config)).toBe('webpack-latest')
    })

    it('should intelligently select most specific range from overlapping ranges', () => {
      // Test the core intelligent matching: higher version requirements = more specific
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'vue',
            match: ['vue'],
            priority: 10,
            specifierRules: [
              { specifier: '>=2.0.0', suffix: 'legacy' }, // Very broad
              { specifier: '>=2.6.0', suffix: 'compatible' }, // More specific
              { specifier: '>=3.0.0', suffix: 'modern' }, // Most specific for 3.x
            ],
          },
        ]),
      }

      // Each version should match the most specific applicable range
      expect(getDepCatalogName(createDep('vue', 'dependencies', '^2.5.0'), config)).toBe('vue-legacy') // Only matches >=2.0.0
      expect(getDepCatalogName(createDep('vue', 'dependencies', '^2.6.14'), config)).toBe('vue-compatible') // Matches >=2.6.0 (more specific)
      expect(getDepCatalogName(createDep('vue', 'dependencies', '^3.2.47'), config)).toBe('vue-modern') // Matches >=3.0.0 (most specific)
    })

    it('should prioritize bounded ranges over unbounded ranges', () => {
      // Test that ranges with upper bounds are considered more specific
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'webpack',
            match: ['webpack'],
            priority: 10,
            specifierRules: [
              { specifier: '>=4.0.0', suffix: 'stable' }, // Unbounded range
              { specifier: '>=4.0.0 <5.0.0', suffix: 'legacy' }, // Bounded range (more specific)
              { specifier: '>=5.0.0 <6.0.0', suffix: 'current' }, // Another bounded range
            ],
          },
        ]),
      }

      // Bounded ranges should win over unbounded ranges for same minimum version
      expect(getDepCatalogName(createDep('webpack', 'devDependencies', '^4.46.0'), config)).toBe('webpack-legacy') // Bounded range wins
      expect(getDepCatalogName(createDep('webpack', 'devDependencies', '^5.80.0'), config)).toBe('webpack-current') // Specific bounded range
      expect(getDepCatalogName(createDep('webpack', 'devDependencies', '^6.0.0'), config)).toBe('webpack-stable') // Only unbounded matches
    })

    it('should handle specifier rules with specific package matching', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'vue',
            match: ['vue', 'vue-router', 'vuex', '@vue/cli'],
            priority: 10,
            specifierRules: [
              { specifier: '>=3.0.0', suffix: 'v3', match: ['vue'] }, // Only applies to vue package
              { specifier: '>=4.0.0', suffix: 'v4', match: ['vue-router', 'vuex'] }, // Applies to vue-router and vuex
            ],
          },
        ]),
      }

      // Vue 3.x should get v3 suffix
      expect(getDepCatalogName(createDep('vue', 'dependencies', '^3.2.47'), config)).toBe('vue-v3')

      // Vue-router 4.x should get v4 suffix
      expect(getDepCatalogName(createDep('vue-router', 'dependencies', '^4.1.0'), config)).toBe('vue-v4')
      expect(getDepCatalogName(createDep('vuex', 'dependencies', '^4.0.2'), config)).toBe('vue-v4')

      // Vue-router 3.x should fallback to rule name (no matching specifier rule)
      expect(getDepCatalogName(createDep('vue-router', 'dependencies', '^3.6.5'), config)).toBe('vue')

      // @vue/cli should fallback to rule name (no specifier rules apply to it)
      expect(getDepCatalogName(createDep('@vue/cli', 'devDependencies', '^5.0.8'), config)).toBe('vue')
    })

    it('should handle specifier rules with regex matching', () => {
      const config: CatalogOptions = {
        ...defaultConfig,
        catalogRules: sortCatalogRules([
          {
            name: 'eslint',
            match: [/^eslint/, /^@typescript-eslint\//],
            priority: 10,
            specifierRules: [
              { specifier: '>=8.0.0', suffix: 'v8', match: ['eslint'] },
              { specifier: '>=5.0.0', suffix: 'v5', match: [/^@typescript-eslint\//] },
            ],
          },
        ]),
      }

      expect(getDepCatalogName(createDep('eslint', 'devDependencies', '^8.50.0'), config)).toBe('eslint-v8')
      expect(getDepCatalogName(createDep('@typescript-eslint/parser', 'devDependencies', '^5.60.0'), config)).toBe('eslint-v5')
      // Other packages without matching specifier rules should fallback
      expect(getDepCatalogName(createDep('eslint-config-airbnb', 'devDependencies', '^19.0.4'), config)).toBe('eslint')
    })
  })
})
