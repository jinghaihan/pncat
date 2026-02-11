import { describe, expect, it, vi } from 'vitest'

interface SetupOptions {
  registry?: string
  npaResult?: { name?: string, scope?: string | null }
  fastLatestVersion?: string
  fetchLatestVersion?: string
}

async function setupNpmUtils(options: SetupOptions = {}) {
  vi.resetModules()

  const NPM_REGISTRY = 'https://registry.npmjs.org/'
  let constructorCalls = 0
  let loadCalls = 0
  let lastCliData: Record<string, string> = {}

  class MockNpmCliConfig {
    data = new Map([
      ['cli', { data: {} as Record<string, string> }],
    ])

    home = '/home/mock'
    globalPrefix = '/global/mock'
    flat = { registry: 'https://registry.example.com', headers: { authorization: 'token' } }

    constructor() {
      constructorCalls += 1
    }

    loadDefaults() {}

    async load() {
      loadCalls += 1
      this.loadDefaults()
      const cli = this.data.get('cli')
      lastCliData = cli?.data || {}
    }
  }

  const npaMock = vi.fn(() => options.npaResult ?? { name: 'react', scope: undefined })
  const pickRegistryMock = vi.fn(() => options.registry ?? NPM_REGISTRY)
  const fastGetLatestVersionMock = vi.fn(async () => ({ version: options.fastLatestVersion }))
  const fetchPickRegistryMock = vi.fn(() => 'https://custom.registry.example.com/')
  const fetchJsonMock = vi.fn(async () => ({
    'dist-tags': {
      latest: options.fetchLatestVersion,
    },
  }))
  const pRetryMock = vi.fn(async (fn: () => Promise<unknown>, _retryOptions: unknown) => await fn())

  vi.doMock('@npmcli/config', () => ({ default: MockNpmCliConfig }))
  vi.doMock('npm-package-arg', () => ({ default: npaMock }))
  vi.doMock('fast-npm-meta', () => ({
    NPM_REGISTRY,
    pickRegistry: pickRegistryMock,
    getLatestVersion: fastGetLatestVersionMock,
  }))
  vi.doMock('npm-registry-fetch', () => ({
    pickRegistry: fetchPickRegistryMock,
    json: fetchJsonMock,
  }))
  vi.doMock('p-retry', () => ({ default: pRetryMock }))

  const mod = await import('../../src/utils/npm')
  return {
    mod,
    NPM_REGISTRY,
    constructorCalls: () => constructorCalls,
    loadCalls: () => loadCalls,
    lastCliData: () => lastCliData,
    mocks: {
      npaMock,
      pickRegistryMock,
      fastGetLatestVersionMock,
      fetchPickRegistryMock,
      fetchJsonMock,
      pRetryMock,
    },
  }
}

describe('getNpmConfig', () => {
  it('caches npm config promise and loads config only once', async () => {
    const { mod, constructorCalls, loadCalls, lastCliData } = await setupNpmUtils()

    const first = mod.getNpmConfig()
    const second = mod.getNpmConfig()

    expect(first).toBe(second)
    await first

    expect(constructorCalls()).toBe(1)
    expect(loadCalls()).toBe(1)
    expect(lastCliData()).toMatchObject({
      userconfig: '/home/mock/.npmrc',
      globalconfig: '/global/mock/etc/npmrc',
    })
  })
})

describe('getLatestVersion', () => {
  it('uses fast-npm-meta for npmjs registry', async () => {
    const { mod, mocks } = await setupNpmUtils({
      fastLatestVersion: '18.3.1',
    })

    await expect(mod.getLatestVersion('react')).resolves.toBe('18.3.1')
    expect(mocks.fastGetLatestVersionMock).toHaveBeenCalledWith('react')
    expect(mocks.fetchJsonMock).not.toHaveBeenCalled()
    expect(mocks.pRetryMock).toHaveBeenCalledWith(expect.any(Function), { retries: 3 })
  })

  it('uses npm-registry-fetch for non-npm registry', async () => {
    const { mod, mocks } = await setupNpmUtils({
      registry: 'https://mirror.registry.example.com/',
      fetchLatestVersion: '4.2.0',
    })

    await expect(mod.getLatestVersion('react')).resolves.toBe('4.2.0')
    expect(mocks.fetchPickRegistryMock).toHaveBeenCalled()
    expect(mocks.fetchJsonMock).toHaveBeenCalledTimes(1)
    expect(mocks.fastGetLatestVersionMock).not.toHaveBeenCalled()
  })

  it('throws when npm-package-arg does not return a package name', async () => {
    const { mod } = await setupNpmUtils({
      npaResult: { name: undefined, scope: undefined },
    })

    await expect(mod.getLatestVersion('invalid')).rejects.toThrowError('Invalid package name: undefined')
  })

  it('throws when resolved version is empty', async () => {
    const { mod } = await setupNpmUtils({
      fastLatestVersion: undefined,
    })

    await expect(mod.getLatestVersion('react')).rejects.toThrowError('Failed to resolve react from npm')
  })
})
