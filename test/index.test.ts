import type { CatalogOptions } from '../src/types'
import { describe, expect, it } from 'vitest'
import { defineConfig } from '../src'

describe('defineConfig', () => {
  it('returns original config object', () => {
    const config: Partial<CatalogOptions> = {
      mode: 'detect',
      recursive: true,
    }

    expect(defineConfig(config)).toBe(config)
  })
})
