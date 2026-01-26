import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { getLatestVersion } from '../utils/npm'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function fixCommand(options: CatalogOptions) {
  const workspace = new Workspace(options)

  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }

  const catalogs = await workspace.catalog.toJSON()
  const invalidCatalogs: { name: string, pkg: string, specifier: string }[] = []

  const scanCatalog = async (name: string, catalog: Record<string, string>) => {
    for (const [pkg, specifier] of Object.entries(catalog)) {
      if (!specifier.startsWith('catalog:'))
        continue

      const spinner = p.spinner({ indicator: 'dots' })
      spinner.start(`resolving ${c.cyan(pkg)} from npm...`)

      const version = await getLatestVersion(pkg)
      if (version) {
        const specifier = `^${version}`
        spinner.stop(`${c.dim('resolved')} ${c.cyan(pkg)}${c.dim(`@${c.green(specifier)}`)}`)
        invalidCatalogs.push({ name, pkg, specifier })
      }
      else {
        spinner.stop(`failed to resolve ${c.cyan(pkg)} from npm`)
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }
  }

  await scanCatalog('default', catalogs.catalog ?? {})
  for (const [name, catalog] of Object.entries(catalogs.catalogs ?? {})) {
    await scanCatalog(name, catalog)
  }

  if (!invalidCatalogs.length) {
    p.log.info(c.green('no invalid catalogs found'))
    p.outro(c.green('fix complete'))
    process.exit(0)
  }

  await confirmWorkspaceChanges(
    async () => {
      for (const item of invalidCatalogs)
        await workspace.catalog.setPackage(item.name, item.pkg, item.specifier)
    },
    {
      workspace,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
      completeMessage: 'fix complete',
    },
  )
}
