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
            /vite/,
            /webpack/,
            /rollup/,
            /rolldown/,
            /esbuild/,
            /unbuild/,
            /tsup/,
            /rspack/,
            /unplugin/,
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
            /postcss/,
            /less/,
            /sass/,
            /tailwindcss/,
            /unocss/,
            /purgecss/,
          ],
          "name": "style",
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
            /vite/,
            /webpack/,
            /rollup/,
            /rolldown/,
            /esbuild/,
            /unbuild/,
            /tsup/,
            /rspack/,
            /unplugin/,
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
            /postcss/,
            /less/,
            /sass/,
            /tailwindcss/,
            /unocss/,
            /purgecss/,
          ],
          "name": "style",
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
