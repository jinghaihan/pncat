import type { CatalogOptions } from './types'
import deepmerge from 'deepmerge'
import { createConfigLoader } from 'unconfig'
import { DEFAULT_CATALOG_OPTIONS } from './constants'
import { detectWorkspaceRoot } from './io'
import { detectPackageManager, getCwd } from './utils'
import { cloneDeep } from './utils/_internal'

function normalizeConfig(options: Partial<CatalogOptions>) {
  // interop
  if ('default' in options)
    options = options.default as Partial<CatalogOptions>

  return options
}

function sanitizeOptions(options: CatalogOptions): CatalogOptions {
  if (typeof options.catalog === 'boolean')
    delete options.catalog
  return options
}

export async function readConfig(options: Partial<CatalogOptions>) {
  const loader = createConfigLoader<CatalogOptions>({
    sources: [
      {
        files: ['pncat.config'],
        extensions: ['ts'],
      },
    ],
    cwd: getCwd(options),
    merge: false,
  })
  const config = await loader.load()
  return config.sources.length ? normalizeConfig(config.config) : {}
}

export async function resolveConfig(options: Partial<CatalogOptions>): Promise<CatalogOptions> {
  const defaults = cloneDeep(DEFAULT_CATALOG_OPTIONS)
  options = normalizeConfig(options)

  const configOptions = await readConfig(options)
  const catalogRules = configOptions.catalogRules || []
  delete configOptions.catalogRules

  const merged = deepmerge(deepmerge(defaults, configOptions), options)

  if (!merged.agent)
    merged.agent = await detectPackageManager(merged.cwd)

  merged.cwd = merged.cwd || await detectWorkspaceRoot(merged.agent)

  merged.catalogRules = catalogRules

  return sanitizeOptions(merged)
}
