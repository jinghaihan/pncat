// ported from: https://github.com/antfu-collective/taze/blob/main/src/utils/npm.ts

import type { Recordable } from '@npmcli/config'
import process from 'node:process'
import pRetry from 'p-retry'
import { dirname, join } from 'pathe'
import { joinURL } from 'ufo'

async function _getNpmConfig() {
  const { default: NpmCliConfig } = await import('@npmcli/config')
  const npmcliConfig = new NpmCliConfig({
    definitions: {},
    shorthands: [],
    npmPath: dirname(process.cwd()),
    flatten: (current, total) => {
      Object.assign(total, current)
    },
  })

  // patch loadDefaults to set defaults of userconfig and globalconfig
  const oldLoadDefaults = npmcliConfig.loadDefaults.bind(npmcliConfig)
  npmcliConfig.loadDefaults = () => {
    oldLoadDefaults()

    const setCliOption = (key: string, value: string) => {
      const cli = npmcliConfig.data.get('cli')
      if (cli)
        cli.data[key] = value
    }
    setCliOption('userconfig', join(npmcliConfig.home, '.npmrc'))
    setCliOption('globalconfig', join(npmcliConfig.globalPrefix, 'etc', 'npmrc'))
  }

  // npmcliConfig.load() would set unnecessary environment variables
  // that would cause install global packages not to work on macOS Homebrew.
  // so we have to do copy old environment variables to new environment
  const oldEnv = { ...process.env }
  await npmcliConfig.load()
  process.env = oldEnv
  return npmcliConfig.flat
}

let _cache: Promise<Recordable> | undefined

export function getNpmConfig() {
  if (!_cache)
    _cache = _getNpmConfig()
  return _cache
}

async function _getLatestVersion(spec: string) {
  const npmConfigs = await getNpmConfig()
  const { default: npa } = await import('npm-package-arg')
  const { name, scope } = npa(spec)
  if (!name)
    throw new Error(`Invalid package name: ${name}`)

  const { pickRegistry, NPM_REGISTRY } = await import('fast-npm-meta')
  const registry = pickRegistry(scope, npmConfigs)

  if (registry === NPM_REGISTRY) {
    const { getLatestVersion } = await import('fast-npm-meta')
    const { version } = await getLatestVersion(spec)
    return version
  }

  const npmRegistryFetch = await import('npm-registry-fetch')
  const url = joinURL(npmRegistryFetch.pickRegistry(spec, npmConfigs), name)

  const { 'dist-tags': { latest } } = await npmRegistryFetch.json(url, {
    ...npmConfigs,
    headers: {
      headers: {
        'user-agent': `pncat@npm node/${process.version}`,
        'accept': 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
        ...npmConfigs.headers,
      },
    },
    spec,
  }) as unknown as { 'dist-tags': { latest: string } & Record<string, string> }

  return latest
}

export async function getLatestVersion(spec: string) {
  return await pRetry(
    async () => {
      const version = await _getLatestVersion(spec)
      if (version)
        return version
      throw new Error(`failed to resolve ${spec} from npm`)
    },
    { retries: 3 },
  )
}
