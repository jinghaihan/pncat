import type { CatalogOptions } from './types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import deepmerge from 'deepmerge'
import { createConfigLoader } from 'unconfig'
import { DEFAULT_CATALOG_OPTIONS, PACKAGE_MANAGERS } from './constants'
import { findWorkspaceRoot } from './io/workspace'
import { DEFAULT_CATALOG_RULES } from './rules'
import { detectPackageManager } from './utils/package-manager'

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
    const packageManager = await detectPackageManager(merged.cwd)
    merged.packageManager = packageManager ?? 'pnpm'
  }
  if (!PACKAGE_MANAGERS.includes(merged.packageManager)) {
    p.outro(c.red(`Unsupported package manager: ${merged.packageManager}`))
    process.exit(1)
  }

  merged.cwd = merged.cwd || await findWorkspaceRoot(merged.packageManager)
  if (typeof merged.catalog === 'boolean')
    delete merged.catalog

  merged.catalogRules = catalogRules

  return merged
}
