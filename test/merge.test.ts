import { describe, expect, it } from 'vitest'
import { mergeCatalogRules } from '../src'

describe('merge catalog rules', () => {
  it('merge not existing name', () => {
    expect(mergeCatalogRules([
      {
        name: 'inlined',
        match: ['@antfu/utils'],
      },
    ])).toMatchInlineSnapshot(`
      [
        {
          "match": [
            /\\^vitest\\$/,
            /\\^jest\\$/,
            /\\^mocha\\$/,
            /\\^cypress\\$/,
            /\\^playwright\\$/,
          ],
          "name": "test",
        },
        {
          "match": [
            /eslint/,
            /prettier/,
            /stylelint/,
            /biome/,
            /commitlint/,
            /\\^lint-staged\\$/,
          ],
          "name": "lint",
        },
        {
          "match": [
            /\\(\\^\\|\\\\/\\)vite\\(-\\|\\$\\)/,
            /\\^webpack\\$/,
            /\\^rollup\\$/,
            /\\^rolldown\\$/,
            /\\^esbuild\\$/,
            /\\^unbuild\\$/,
            /\\^tsup\\$/,
            /\\^rspack\\$/,
          ],
          "name": "build",
        },
        {
          "match": [
            /\\^tsx\\$/,
            /\\^esno\\$/,
          ],
          "name": "script",
        },
        {
          "match": [
            /\\^vue\\$/,
            /\\^vue-router\\$/,
            /\\^vuex\\$/,
            /\\^pinia\\$/,
            /\\^element-plus\\$/,
            /\\^ant-design-vue\\$/,
            /\\^vuetify\\$/,
            /\\^naive-ui\\$/,
            /\\^echarts\\$/,
          ],
          "name": "frontend",
        },
        {
          "match": [
            /\\^@iconify\\\\//,
            /\\^iconify\\$/,
            /\\^lucide\\$/,
            /icon/,
          ],
          "name": "icons",
        },
        {
          "match": [
            /\\^express\\$/,
            /\\^koa\\$/,
          ],
          "name": "backend",
        },
        {
          "depFields": [
            "devDependencies",
          ],
          "match": [
            /\\^@types\\\\//,
          ],
          "name": "types",
        },
        {
          "match": [
            "@antfu/utils",
          ],
          "name": "inlined",
        },
      ]
    `)
  })

  it('merge existing name', () => {
    expect(mergeCatalogRules([
      {
        name: 'script',
        match: ['@antfu/nip'],
      },
    ])).toMatchInlineSnapshot(`
      [
        {
          "match": [
            /\\^vitest\\$/,
            /\\^jest\\$/,
            /\\^mocha\\$/,
            /\\^cypress\\$/,
            /\\^playwright\\$/,
          ],
          "name": "test",
        },
        {
          "match": [
            /eslint/,
            /prettier/,
            /stylelint/,
            /biome/,
            /commitlint/,
            /\\^lint-staged\\$/,
          ],
          "name": "lint",
        },
        {
          "match": [
            /\\(\\^\\|\\\\/\\)vite\\(-\\|\\$\\)/,
            /\\^webpack\\$/,
            /\\^rollup\\$/,
            /\\^rolldown\\$/,
            /\\^esbuild\\$/,
            /\\^unbuild\\$/,
            /\\^tsup\\$/,
            /\\^rspack\\$/,
          ],
          "name": "build",
        },
        {
          "match": [
            /\\^tsx\\$/,
            /\\^esno\\$/,
            "@antfu/nip",
          ],
          "name": "script",
        },
        {
          "match": [
            /\\^vue\\$/,
            /\\^vue-router\\$/,
            /\\^vuex\\$/,
            /\\^pinia\\$/,
            /\\^element-plus\\$/,
            /\\^ant-design-vue\\$/,
            /\\^vuetify\\$/,
            /\\^naive-ui\\$/,
            /\\^echarts\\$/,
          ],
          "name": "frontend",
        },
        {
          "match": [
            /\\^@iconify\\\\//,
            /\\^iconify\\$/,
            /\\^lucide\\$/,
            /icon/,
          ],
          "name": "icons",
        },
        {
          "match": [
            /\\^express\\$/,
            /\\^koa\\$/,
          ],
          "name": "backend",
        },
        {
          "depFields": [
            "devDependencies",
          ],
          "match": [
            /\\^@types\\\\//,
          ],
          "name": "types",
        },
      ]
    `)
  })

  it('not merget with default rules', () => {
    expect(mergeCatalogRules({ mergeDefaults: false }, [
      {
        name: 'inlined',
        match: ['@antfu/utils'],
      },
    ])).toMatchInlineSnapshot(`
      [
        {
          "match": [
            "@antfu/utils",
          ],
          "name": "inlined",
        },
      ]
    `)
  })
})
