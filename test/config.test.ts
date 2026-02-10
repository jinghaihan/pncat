import type { CatalogOptions } from '../src/types'
import { realpath } from 'node:fs/promises'
import process from 'node:process'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config'
import { detectPackageManager } from '../src/utils'
import { getFixtureCwd, getFixturePath } from './_shared'

describe('utils/package-manager', () => {
  it('detects package manager from fixture lock markers', async () => {
    const cases = [
      { agent: 'yarn', cwd: getFixturePath('yarn', 'packages', 'app') },
      { agent: 'bun', cwd: getFixturePath('bun', 'packages', 'app') },
    ] as const

    for (const item of cases) {
      const agent = await detectPackageManager(item.cwd)
      expect(agent).toBe(item.agent)
    }
  })

  it('falls back to pnpm when no explicit marker is detected', async () => {
    const agent = await detectPackageManager(getFixturePath('plain', 'packages', 'app'))
    expect(agent).toBe('pnpm')
  })
})

describe('config/resolveConfig', () => {
  it('uses provided cwd to infer agent', async () => {
    const nested = getFixturePath('bun', 'packages', 'app')

    const config = await resolveConfig({ cwd: nested })
    expect(config.agent).toBe('bun')
    expect(resolve(config.cwd || '')).toBe(resolve(nested))
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
    const input = { cwd: getFixtureCwd('pnpm'), catalog: true } as unknown as Partial<CatalogOptions>
    const config = await resolveConfig(input)
    expect('catalog' in config).toBe(false)
  })
})
