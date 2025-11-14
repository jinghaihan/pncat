import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  ResolverContext,
  ResolverResult,
} from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { isCatalogPackageName } from '../utils/catalog'
import { parseCommandOptions, runAgentRemove } from '../utils/process'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function removeCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)
  if (args.length === 0) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const workspace = new Workspace(options)
  const { dependencies = [], updatedPackages = {} } = await resolveRemove({
    args,
    options,
    workspace,
  })

  await confirmWorkspaceChanges(
    async () => {
      await workspace.catalog.removePackages(dependencies)
    },
    {
      workspace,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
      completeMessage: 'remove complete',
    },
  )
}

export async function resolveRemove(context: ResolverContext): Promise<ResolverResult> {
  const { args = [], options, workspace } = context

  await workspace.loadPackages()

  const { deps, isRecursive } = parseCommandOptions(args)
  if (!deps.length) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    p.outro(c.red('no workspace file found'))
    await runAgentRemove(deps, {
      cwd: process.cwd(),
      agent: options.agent,
      recursive: isRecursive,
    })
    return { dependencies: [], updatedPackages: {} }
  }

  const noncatalogDeps: string[] = []
  const dependencies: RawDep[] = []
  const updatedPackages: Map<string, PackageJsonMeta> = new Map()

  for (const dep of deps) {
    const packages = workspace.getDepPackages(dep)
    if (!packages.length) {
      p.outro(c.red(`${dep} is not used in any package, aborting`))
      process.exit(1)
    }

    let catalogPkgs = packages.filter(i => isCatalogPackageName(i))

    // remove it from the package.json
    if (catalogPkgs.length === 0)
      noncatalogDeps.push(dep)

    // if found in multiple catalogs, select the catalog to remove it from
    if (catalogPkgs.length > 1) {
      const result = await p.multiselect({
        message: `${c.cyan(dep)} found in multiple catalogs, please select the catalog to remove it from`,
        options: catalogPkgs.map(i => ({
          label: i,
          value: i,
        })),
        initialValues: catalogPkgs,
      })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('no catalog selected, aborting'))
        process.exit(1)
      }
      catalogPkgs = catalogPkgs.filter(i => result.includes(i))
    }

    await Promise.all(catalogPkgs.map(async (catalog) => {
      const rawDep = workspace.getCatalogDep(dep, catalog)
      if (rawDep) {
        const { catalogDeletable } = await workspace.removePackageDep(
          dep,
          rawDep.catalogName,
          isRecursive,
          updatedPackages,
        )
        if (catalogDeletable)
          dependencies.push(rawDep)
      }
    }))
  }

  if (noncatalogDeps.length) {
    p.outro(c.yellow(`${noncatalogDeps.join(', ')} is not used in any catalog`))
    await runAgentRemove(noncatalogDeps, {
      cwd: process.cwd(),
      agent: options.agent,
      recursive: isRecursive,
    })
  }

  return {
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}
