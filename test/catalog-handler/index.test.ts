import { describe, expect, it } from 'vitest'
import { createCatalogHandler } from '../../src/catalog-handler'
import { PACKAGE_MANAGERS } from '../../src/constants'
import { createFixtureOptions, getFixtureCwd } from '../_shared'

describe('createCatalogHandler', () => {
  it('creates expected handler classes by package manager', () => {
    const expected = {
      pnpm: 'PnpmCatalog',
      yarn: 'YarnCatalog',
      bun: 'BunCatalog',
      vlt: 'VltCatalog',
    } as const

    for (const agent of PACKAGE_MANAGERS) {
      const handler = createCatalogHandler(createFixtureOptions(agent))
      expect(handler.constructor.name).toBe(expected[agent])
    }
  })

  it('defaults to pnpm handler when agent is not provided', () => {
    const handler = createCatalogHandler({ cwd: getFixtureCwd('pnpm') })
    expect(handler.constructor.name).toBe('PnpmCatalog')
  })

  it('throws for unsupported package manager', () => {
    // @ts-expect-error runtime guard test for unsupported package manager value
    expect(() => createCatalogHandler({ cwd: getFixtureCwd('pnpm'), agent: 'npm' })).toThrowError('Unsupported package manager: npm')
  })
})
