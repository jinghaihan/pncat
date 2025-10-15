import type { CatalogOptions } from '../src/types'
import { beforeAll, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config'
import { DEFAULT_CATALOG_OPTIONS } from '../src/constants'
import { inferCatalogName } from '../src/utils/catalog'
import { createDep } from './_utils'

describe('inferCatalogName', () => {
  let config: CatalogOptions

  beforeAll(async () => {
    config = await resolveConfig({
      ...DEFAULT_CATALOG_OPTIONS,
    })
  })

  it('should work with default catalog rules', () => {
    expect(inferCatalogName(createDep('@types/node'), config)).toBe('types')
    expect(inferCatalogName(createDep('turbo'), config)).toBe('monorepo')
    expect(inferCatalogName(createDep('eslint'), config)).toBe('lint')
    expect(inferCatalogName(createDep('pncat'), config)).toBe('cli')
    expect(inferCatalogName(createDep('vitest'), config)).toBe('test')
    expect(inferCatalogName(createDep('playwright'), config)).toBe('e2e')
    expect(inferCatalogName(createDep('@intlify/unplugin-vue-i18n'), config)).toBe('i18n')
    expect(inferCatalogName(createDep('vite'), config)).toBe('build')
    expect(inferCatalogName(createDep('jiti'), config)).toBe('script')
    expect(inferCatalogName(createDep('unocss'), config)).toBe('style')
    expect(inferCatalogName(createDep('fetch-event-stream'), config)).toBe('network')
    expect(inferCatalogName(createDep('@iconify-json/lucide'), config)).toBe('icons')
    expect(inferCatalogName(createDep('shiki'), config)).toBe('syntax')
    expect(inferCatalogName(createDep('markdown-it'), config)).toBe('markdown')
    expect(inferCatalogName(createDep('pinia-plugin-persistedstate'), config)).toBe('frontend')
    expect(inferCatalogName(createDep('express'), config)).toBe('backend')
    expect(inferCatalogName(createDep('@vueuse/core'), config)).toBe('utils')
    expect(inferCatalogName(createDep('pathe'), config)).toBe('node')
    expect(inferCatalogName(createDep('cli-spinner'), config)).toBe('node')
    expect(inferCatalogName(createDep('typeorm'), config)).toBe('database')

    expect(inferCatalogName(createDep('@types/vscode'), config)).toBe('types')
    expect(inferCatalogName(createDep('reactive-vscode'), config)).toBe('vscode')
  })

  it('should name with catalog rules order', () => {
    const options = {
      ...config,
      catalogRules: [
        { name: 'framework', match: ['vue'], priority: 0 },
        { name: 'frontend', match: ['vue'], priority: 10 },
      ],
    }

    expect(inferCatalogName(createDep('vue'), options)).toBe('framework')
  })

  it('should fallback by dep source if no match', () => {
    expect(inferCatalogName(createDep('leaflet'), config)).toBe('prod')
    expect(inferCatalogName(createDep('typescript', '^1.0.0', 'devDependencies'), config)).toBe('tsc')
    expect(inferCatalogName(createDep('babel-core', '^1.0.0', 'peerDependencies'), config)).toBe('peer')
    expect(inferCatalogName(createDep('node-pty', '^1.0.0', 'optionalDependencies'), config)).toBe('optional')
    expect(inferCatalogName(createDep('vsce', '^1.0.0', 'resolutions'), config)).toBe('cli')
    expect(inferCatalogName(createDep('ffmpeg', '^1.0.0', 'resolutions'), config)).toBe('default')
  })

  it('specifier rules should work', () => {
    const options = {
      ...config,
      catalogRules: [
        {
          name: 'vue',
          match: ['vue', 'vue-router', 'vuex'],
          specifierRules: [
            { specifier: '^1.0.0', match: 'vue', suffix: 'v1' },
            { specifier: '^2.0.0', match: 'vue', suffix: 'v2' },
            { specifier: '^3.0.0', match: 'vue', suffix: 'v3' },
            { specifier: '^3.0.0', match: 'vuex', suffix: 'v2' },
            { specifier: '^4.0.0', match: 'vuex', suffix: 'v3' },
          ],
        },
      ],
    }

    expect(inferCatalogName(createDep('vue', '^1.0.0'), options)).toBe('vue-v1')
    expect(inferCatalogName(createDep('vue', '^2.0.0'), options)).toBe('vue-v2')
    expect(inferCatalogName(createDep('vue', '^3.0.0'), options)).toBe('vue-v3')

    expect(inferCatalogName(createDep('vue-router'), options)).toBe('vue')

    expect(inferCatalogName(createDep('vuex', '^3.0.0'), options)).toBe('vue-v2')
    expect(inferCatalogName(createDep('vuex', '^4.0.0'), options)).toBe('vue-v3')
  })

  it('specifier rules name has higher priority than suffix', () => {
    const options = {
      ...config,
      catalogRules: [
        {
          name: 'vue',
          match: ['vue'],
          specifierRules: [
            { specifier: '^3.0.0', name: 'vue-next', suffix: 'v3' },
          ],
        },
      ],
    }

    expect(inferCatalogName(createDep('vue', '^3.0.0'), options)).toBe('vue-next')
  })

  it('should auto compare if specifier rules has conflict', () => {
    const options = {
      ...config,
      catalogRules: [
        {
          name: 'vue',
          match: ['vue'],
          specifierRules: [
            { specifier: '>=2.0.0', suffix: 'legacy' },
            { specifier: '>=3.0.0', suffix: 'next' },
          ],
        },
      ],
    }

    expect(inferCatalogName(createDep('vue', '^1.0.0'), options)).toBe('vue')
    expect(inferCatalogName(createDep('vue', '^2.7.16'), options)).toBe('vue-legacy')
    expect(inferCatalogName(createDep('vue', '^3.6.0'), options)).toBe('vue-next')
  })

  it('test special regex match', () => {
    expect(inferCatalogName(createDep('fs', '^1.0.0', 'devDependencies'), config)).toBe('dev')
    expect(inferCatalogName(createDep('fs-extra'), config)).toBe('node')
    expect(inferCatalogName(createDep('graceful-fs'), config)).toBe('node')

    expect(inferCatalogName(createDep('pkg'), config)).toBe('prod')
    expect(inferCatalogName(createDep('pkg-types'), config)).toBe('node')
    expect(inferCatalogName(createDep('local-pkg'), config)).toBe('node')

    expect(inferCatalogName(createDep('find'), config)).toBe('prod')
    expect(inferCatalogName(createDep('find-up'), config)).toBe('node')
    expect(inferCatalogName(createDep('find-root'), config)).toBe('node')

    expect(inferCatalogName(createDep('ui'), config)).toBe('prod')
    expect(inferCatalogName(createDep('guide'), config)).toBe('prod')
    expect(inferCatalogName(createDep('reka-ui'), config)).toBe('frontend')
    expect(inferCatalogName(createDep('@storybook/ui'), config)).toBe('frontend')
  })
})
