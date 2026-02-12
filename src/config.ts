import type { CatalogOptions, CommandOptions } from './types'
import deepmerge from 'deepmerge'
import { createConfigLoader } from 'unconfig'
import { DEFAULT_CATALOG_OPTIONS, PACKAGE_MANAGERS } from './constants'
import { detectWorkspaceRoot } from './io'
import { cloneDeep, detectPackageManager, getCwd } from './utils'

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

export async function resolveConfig(options: Partial<CommandOptions>): Promise<CatalogOptions> {
  const defaults = cloneDeep(DEFAULT_CATALOG_OPTIONS)
  options = normalizeConfig(options)

  const configOptions = await readConfig(options)

  // catalog rules can only be defined in the config file
  const catalogRules = configOptions.catalogRules || []
  delete configOptions.catalogRules

  const merged = deepmerge<CatalogOptions>(deepmerge(defaults, configOptions), options)

  if (!merged.agent || !PACKAGE_MANAGERS.includes(merged.agent))
    merged.agent = await detectPackageManager(merged.cwd)
  merged.cwd = merged.cwd || await detectWorkspaceRoot(merged.agent)
  merged.catalogRules = catalogRules

  return sanitizeOptions(merged)
}
