import type {
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  ResolverContext,
  ResolverResult,
} from '../types'
import type { ConfirmationOptions } from '../utils/workspace'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import cloneDeep from 'lodash.clonedeep'
import { updatePackageToSpecifier } from '../utils/helper'
import { parseCommandOptions } from '../utils/process'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function revertCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)

  const workspace = new Workspace(options)
  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }

  await workspace.catalog.ensureWorkspace()
  const { isRevertAll, dependencies = [], updatedPackages = {} } = await resolveRevert({
    args,
    options,
    workspace,
  })

  const confirmationOptions: ConfirmationOptions = {
    workspace,
    updatedPackages,
    yes: options.yes,
    verbose: options.verbose,
    bailout: true,
    completeMessage: 'revert complete',
  }

  if (isRevertAll) {
    if (!options.yes) {
      const result = await p.confirm({
        message: c.green('all catalog dependencies will be reverted, are you sure?'),
      })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }

    await confirmWorkspaceChanges(
      async () => {
        await workspace.catalog.clearCatalogs()
      },
      { ...confirmationOptions, showDiff: false },
    )
  }
  else {
    await confirmWorkspaceChanges(
      async () => {
        await workspace.catalog.removePackages(dependencies)
      },
      confirmationOptions,
    )
  }
}

export async function resolveRevert(context: ResolverContext): Promise<ResolverResult> {
  const { args = [], workspace } = context

  const { deps } = parseCommandOptions(args)
  const depFilter = (depName: string) => {
    if (!deps.length)
      return true
    return deps.includes(depName)
  }

  const packages = await workspace.loadPackages()
  const dependencies: RawDep[] = []
  const updatedPackages: Map<string, PackageJsonMeta> = new Map()

  const setPackage = async (dep: RawDep, pkg: PackageJsonMeta) => {
    if (!updatedPackages.has(pkg.name))
      updatedPackages.set(pkg.name, cloneDeep(pkg))

    const data = updatedPackages.get(pkg.name)!
    await updatePackageToSpecifier(dep, data)
  }

  for (const pkg of packages) {
    if (workspace.isCatalogPackage(pkg))
      continue
    for (const dep of pkg.deps) {
      if (!depFilter(dep.name))
        continue

      const resolvedDep = workspace.resolveDep(dep)
      dependencies.push(resolvedDep)
      await setPackage(resolvedDep, pkg)
    }
  }

  return {
    isRevertAll: !deps.length,
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}
