import { describe, expect, it } from 'vitest'
import { parseDependencies, parseDependency } from '../../src/utils'
import { createFixtureOptions } from '../_shared'

describe('parseDependencies', () => {
  it('flattens nested dependency objects with parent chain', () => {
    const deps = parseDependencies(
      {
        pnpm: {
          overrides: {
            react: '^18.3.1',
          },
        },
      },
      'pnpm.overrides',
      () => true,
      createFixtureOptions(),
    )

    expect(deps).toMatchInlineSnapshot(`
      [
        {
          "catalogName": "override",
          "catalogable": true,
          "isCatalog": false,
          "name": "react",
          "parents": [],
          "source": "pnpm.overrides",
          "specifier": "^18.3.1",
        },
      ]
    `)
  })
})

describe('parseDependency', () => {
  it('extracts catalog name from workspace package name', () => {
    const dep = parseDependency(
      'react',
      '^18.3.1',
      'pnpm-workspace',
      () => true,
      createFixtureOptions(),
      [],
      'pnpm-catalog:ui',
    )

    expect(dep.catalogName).toBe('ui')
  })

  it('does not extract catalog name for pnpm overrides pseudo package', () => {
    const dep = parseDependency(
      'react',
      'catalog:',
      'pnpm-workspace',
      () => true,
      createFixtureOptions(),
      [],
      'pnpm-workspace:overrides',
    )

    expect(dep.catalogName).toBe('override')
  })
})
