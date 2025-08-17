import type { CatalogOptions } from './types'
import process from 'node:process'
import deepmerge from 'deepmerge'
import { createConfigLoader } from 'unconfig'
import { DEFAULT_CATALOG_OPTIONS } from './constants'
import { findWorkspaceRoot } from './io/workspace'
import { DEFAULT_CATALOG_RULES } from './rules'

function normalizeConfig(options: Partial<CatalogOptions>) {
  // interop
  if ('default' in options)
    options = options.default as Partial<CatalogOptions>

  return options
}

export async function resolveConfig(options: Partial<CatalogOptions>): Promise<CatalogOptions> {
  const defaults = structuredClone(DEFAULT_CATALOG_OPTIONS)
  options = normalizeConfig(options)

  const loader = createConfigLoader<CatalogOptions>({
    sources: [
      {
        files: ['pncat.config'],
      },
      {
        files: ['.pncatrc'],
        extensions: ['json', ''],
      },
    ],
    cwd: options.cwd || process.cwd(),
    merge: false,
  })
  const config = await loader.load()
  const configOptions = config.sources.length ? normalizeConfig(config.config) : {}

  const catalogRules = configOptions.catalogRules || structuredClone(DEFAULT_CATALOG_RULES) || []
  delete configOptions.catalogRules

  const merged = deepmerge(deepmerge(defaults, configOptions), options)

  merged.cwd = merged.cwd || await findWorkspaceRoot()
  if (typeof merged.catalog === 'boolean')
    delete merged.catalog

  merged.catalogRules = catalogRules

  return merged
}
