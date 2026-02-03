import type { CatalogOptions } from './types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import deepmerge from 'deepmerge'
import cloneDeep from 'lodash.clonedeep'
import { createConfigLoader } from 'unconfig'
import { AGENTS, DEFAULT_CATALOG_OPTIONS } from './constants'
import { detectWorkspaceRoot } from './io/workspace'
import { detectAgent } from './utils/package-manager'

function normalizeConfig(options: Partial<CatalogOptions>) {
  // interop
  if ('default' in options)
    options = options.default as Partial<CatalogOptions>

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
    cwd: options.cwd || process.cwd(),
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

  // detect package manager
  if (!merged.agent) {
    const agent = await detectAgent(merged.cwd)
    merged.agent = agent || 'pnpm'
  }
  if (!AGENTS.includes(merged.agent)) {
    p.outro(c.red(`Unsupported package manager: ${merged.agent}`))
    process.exit(1)
  }

  merged.cwd = merged.cwd || await detectWorkspaceRoot(merged.agent)
  if (typeof merged.catalog === 'boolean')
    delete merged.catalog

  merged.catalogRules = catalogRules

  return merged
}
