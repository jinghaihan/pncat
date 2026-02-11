import type { CatalogOptions, PackageJsonMeta, RawDep, ResolverContext, ResolverResult } from '@/types'
import process from 'node:process'
import { isCatalogSpecifier, isPnpmOverridesPackageName } from '@/utils'
import { WorkspaceManager } from '@/workspace-manager'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  createCommandError,
  ensureWorkspaceFile,
  parseCommandOptions,
} from './shared'

export async function revertCommand(options: CatalogOptions): Promise<void> {
  const args = process.argv.slice(3)
  const workspace = new WorkspaceManager(options)

  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath)
    throw createCommandError(COMMAND_ERROR_CODES.NOT_FOUND, 'no workspace file found, aborting')

  await ensureWorkspaceFile(workspace)
  const {
    isRevertAll = false,
    dependencies = [],
    updatedPackages = {},
  } = await resolveRevert({
    args,
    options,
    workspace,
  })

  const confirmationOptions = {
    workspace,
    updatedPackages,
    yes: options.yes,
    verbose: options.verbose,
    bailout: true,
    completeMessage: 'revert complete',
  } as const

  if (isRevertAll) {
    await confirmWorkspaceChanges(
      async () => {
        await workspace.catalog.clearCatalogs()
      },
      {
        ...confirmationOptions,
        showDiff: false,
        confirmMessage: 'all catalog dependencies will be reverted, are you sure?',
      },
    )
    return
  }

  await confirmWorkspaceChanges(
    async () => {
      await workspace.catalog.removePackages(dependencies)
    },
    confirmationOptions,
  )
}

export async function resolveRevert(context: ResolverContext): Promise<ResolverResult> {
  const { args = [], workspace } = context
  await workspace.loadPackages()

  const { deps } = parseCommandOptions(args)
  const depFilter = (depName: string) => deps.length === 0 || deps.includes(depName)
  const catalogIndex = await workspace.getCatalogIndex()

  const dependencies: RawDep[] = []
  const updatedPackages = new Map<string, PackageJsonMeta>()

  for (const pkg of workspace.getProjectPackages()) {
    if (isPnpmOverridesPackageName(pkg.name))
      continue

    for (const dep of pkg.deps) {
      if (!depFilter(dep.name))
        continue
      if (!isCatalogSpecifier(dep.specifier))
        continue

      const resolvedDep = workspace.resolveCatalogDependency(dep, catalogIndex, false)
      dependencies.push(resolvedDep)
      workspace.setDependencySpecifier(updatedPackages, pkg, resolvedDep, resolvedDep.specifier)
    }
  }

  return {
    isRevertAll: deps.length === 0,
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}
