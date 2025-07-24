import type { CatalogOptions, RawDep } from '../src/types'
import { beforeAll, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config'
import { mergeCatalogRules } from '../src/utils/merge'
import { getDepCatalogName } from '../src/utils/rule'
import { sortCatalogRules } from '../src/utils/sort'

describe('getDepCatalogName', () => {
  let defaultConfig: CatalogOptions

  // Helper function to create RawDep with minimal required fields
  function createDep(name: string, source: RawDep['source'] = 'dependencies'): RawDep {
    return {
      name,
      specifier: '^1.0.0',
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
})
