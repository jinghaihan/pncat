import type { CatalogOptions, CommonOptions } from './types'
import process from 'node:process'
import deepmerge from 'deepmerge'
import { createConfigLoader } from 'unconfig'
import { DEFAULT_CATALOG_OPTIONS } from './constants'
import { sortCatalogRules } from './utils/sort'

function normalizeConfig(options: Partial<CommonOptions>) {
  // interop
  if ('default' in options)
    options = options.default as Partial<CommonOptions>

  return options
}

export async function resolveConfig(
  options: Partial<CommonOptions>,
): Promise<CatalogOptions> {
  const defaults = { ...DEFAULT_CATALOG_OPTIONS }
  options = normalizeConfig(options)

  const loader = createConfigLoader<CommonOptions>({
    sources: [
      {
        files: [
          'pncat.config',
        ],
      },
      {
        files: [
          '.pncatrc',
        ],
        extensions: ['json', ''],
      },
    ],
    cwd: options.cwd || process.cwd(),
    merge: false,
  })

  const config = await loader.load()

  if (!config.sources.length)
    return deepmerge(defaults, options)

  const configOptions = normalizeConfig(config.config)

  const catalogRules = configOptions.catalogRules ?? defaults.catalogRules
  delete configOptions.catalogRules

  const merged = deepmerge(deepmerge(defaults, configOptions), options)
  merged.catalogRules = catalogRules ? sortCatalogRules(catalogRules) : []

  return merged
}
