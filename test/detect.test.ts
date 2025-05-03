import type { CatalogOptions } from '../src/types'
import process from 'node:process'
import * as p from '@clack/prompts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectCommand } from '../src/commands'
import { resolveConfig } from '../src/config'

describe('detect command', () => {
  beforeEach(() => {
    vi.mock('@clack/prompts', async importActual => ({
      ...await importActual(),
      note: vi.fn(),
      outro: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detect root package.json', async () => {
    const options: Partial<CatalogOptions> = {
      cwd: `${process.cwd()}/test/fixtures/monorepo`,
      recursive: false,
    }
    const resolved = await resolveConfig(options)

    await detectCommand(resolved)

    const calls = vi.mocked(p.note).mock.calls
    const lastCall = calls[calls.length - 1]

    expect(p.note).toHaveBeenCalled()
    expect(lastCall[0]).toContain('webpack (1)')
    expect(lastCall[0]).toContain('lodash (1)')
  })

  it('recursive detect workspace', async () => {
    const options: Partial<CatalogOptions> = {
      cwd: `${process.cwd()}/test/fixtures/monorepo`,
      recursive: true,
    }
    const resolved = await resolveConfig(options)

    await detectCommand(resolved)

    const calls = vi.mocked(p.note).mock.calls
    const lastCall = calls[calls.length - 1]

    expect(p.note).toHaveBeenCalled()
    expect(lastCall[0]).toContain('webpack (2)')
    expect(lastCall[0]).toContain('lodash (3)')
  })
})
