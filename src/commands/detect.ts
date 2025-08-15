import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { PnpmCatalogManager } from '../pnpm-catalog-manager'
import { renderChanges } from '../utils/render'
import { resolveMigrate } from '../utils/resolver'

export async function detectCommand(options: CatalogOptions) {
  const pnpmCatalogManager = new PnpmCatalogManager(options)

  const { dependencies = [], updatedPackages = {} } = await resolveMigrate({
    options,
    pnpmCatalogManager,
  })
  const deps = dependencies.filter(i => i.update)

  if (!deps.length) {
    p.outro(c.yellow('no dependencies to migrate, aborting'))
    process.exit(0)
  }

  p.log.info(`📦 Found ${c.yellow(deps.length)} dependencies to migrate`)

  let result = renderChanges(deps, updatedPackages)
  if (result) {
    result += `\nrun ${c.green('pncat migrate')}${options.force ? c.green(' -f') : ''} to apply changes`
    p.note(c.reset(result))
  }

  p.outro(c.green('detect complete'))
}
