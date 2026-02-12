import type { CatalogOptions } from '@/types'
import { realpath } from 'node:fs/promises'
import process from 'node:process'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { readConfig, resolveConfig } from '@/config'
import { getFixtureCwd, getFixturePath, getFixtureScenarioPath } from './_shared'

describe('resolveConfig', () => {
  it('loads config from pncat.config.ts default export', async () => {
    const config = await readConfig({
      cwd: getFixtureScenarioPath('config-file'),
    })

    expect(config.agent).toBe('yarn')
    expect(config.recursive).toBe(false)
  })

  it('supports interop default config shape', async () => {
    const input: Partial<CatalogOptions> & { default: Partial<CatalogOptions> } = {
      default: {
        cwd: getFixtureCwd('pnpm'),
      },
    }

    const config = await resolveConfig(input)
    expect(config.agent).toBe('pnpm')
    expect(resolve(config.cwd || '')).toBe(resolve(getFixtureCwd('pnpm')))
  })

  it('uses provided cwd to infer agent', async () => {
    const nested = getFixturePath('bun', 'packages', 'app')

    const config = await resolveConfig({ cwd: nested })
    expect(config.agent).toBe('bun')
    expect(resolve(config.cwd || '')).toBe(resolve(nested))
  })

  it('respects explicitly provided agent without re-detecting', async () => {
    const config = await resolveConfig({
      cwd: getFixturePath('bun', 'packages', 'app'),
      agent: 'pnpm',
    })

    expect(config.agent).toBe('pnpm')
  })

  it('resolves workspace root from process cwd when cwd is not provided', async () => {
    const nested = getFixturePath('yarn', 'packages', 'app')
    const previous = process.cwd()

    try {
      process.chdir(nested)
      const config = await resolveConfig({})
      expect(config.agent).toBe('yarn')
      expect(await realpath(resolve(config.cwd || ''))).toBe(await realpath(resolve(getFixtureCwd('yarn'))))
    }
    finally {
      process.chdir(previous)
    }
  })

  it('removes boolean catalog option during sanitize', async () => {
    // @ts-expect-error legacy boolean catalog value is sanitized at runtime
    const input: Partial<CatalogOptions> = { cwd: getFixtureCwd('pnpm'), catalog: true }
    const config = await resolveConfig(input)
    expect('catalog' in config).toBe(false)
  })
})
