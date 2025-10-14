import type { CatalogOptions, PackageManager } from './types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import deepmerge from 'deepmerge'
import { detect } from 'package-manager-detector/detect'
import { createConfigLoader } from 'unconfig'
import { DEFAULT_CATALOG_OPTIONS, PACKAGE_MANAGERS } from './constants'
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
        extensions: ['ts'],
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

  // detect package manager
  if (!merged.packageManager) {
    const packageManager = await detect({ cwd: merged.cwd })
    merged.packageManager = (packageManager?.name || 'pnpm') as CatalogOptions['packageManager']
  }
  if (!PACKAGE_MANAGERS.includes(merged.packageManager as PackageManager)) {
    p.outro(c.red(`Unsupported package manager: ${merged.packageManager}`))
    process.exit(1)
  }

  merged.cwd = merged.cwd || await findWorkspaceRoot(merged.packageManager)
  if (typeof merged.catalog === 'boolean')
    delete merged.catalog

  merged.catalogRules = catalogRules

  return merged
}
