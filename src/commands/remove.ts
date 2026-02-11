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
import { join } from 'pathe'
import {
  cloneDeep,
  ensurePnpmOverrides,
  getPackageJsonDeps,
  isCatalogSpecifier,
  isPackageJsonDepSource,
  isPnpmOverridesPackageName,
  parseCatalogSpecifier,
} from '../utils'
import { WorkspaceManager } from '../workspace-manager'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  createCommandError,
  ensureWorkspaceFile,
  parseCommandOptions,
  runAgentRemove,
} from './shared'

export async function removeCommand(options: CatalogOptions): Promise<void> {
  const args = process.argv.slice(3)
  if (args.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

  const workspace = new WorkspaceManager(options)
  const workspaceFilepath = await workspace.catalog.findWorkspaceFile()
  if (!workspaceFilepath) {
    const { deps, isRecursive } = parseCommandOptions(args, options)
    if (deps.length === 0)
      throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

    await runAgentRemove(deps, {
      cwd: workspace.getCwd(),
      agent: options.agent,
      recursive: isRecursive,
    })
    p.outro(c.green('remove complete'))
    return
  }

  await ensureWorkspaceFile(workspace)
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

  const { deps, isRecursive } = parseCommandOptions(args, options)
  if (deps.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

  const updatedPackages = new Map<string, PackageJsonMeta>()
  const dependencies: RawDep[] = []
  const noncatalogDeps: string[] = []

  const projectPackages = workspace.getProjectPackages()
  const workspacePackages = workspace.getWorkspacePackages()
  const currentPackagePath = join(workspace.getCwd(), 'package.json')
  const targetPackages = isRecursive
    ? projectPackages
    : projectPackages.filter(pkg => pkg.filepath === currentPackagePath)
  const targetPackagePaths = new Set(targetPackages.map(pkg => pkg.filepath))

  for (const depName of deps) {
    const usedPackages = projectPackages.filter(pkg => pkg.deps.some(dep => dep.name === depName))
    if (usedPackages.length === 0)
      throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, `${depName} is not used in any package, aborting`)

    const catalogDeps = workspacePackages
      .flatMap(pkg => pkg.deps)
      .filter(dep => dep.name === depName)

    if (catalogDeps.length === 0) {
      noncatalogDeps.push(depName)
      continue
    }

    const selectedCatalogs = await selectCatalogs(depName, catalogDeps, options)
    for (const catalogName of selectedCatalogs) {
      removeCatalogDepFromTargetPackages(targetPackages, depName, catalogName, updatedPackages)

      const hasRemainingReference = projectPackages.some((pkg) => {
        if (targetPackagePaths.has(pkg.filepath))
          return false

        return pkg.deps.some(dep =>
          dep.name === depName
          && isCatalogSpecifier(dep.specifier)
          && parseCatalogSpecifier(dep.specifier) === catalogName,
        )
      })

      if (!hasRemainingReference) {
        const removable = catalogDeps.find(dep => dep.catalogName === catalogName)
        if (removable)
          dependencies.push(removable)
      }
    }
  }

  if (noncatalogDeps.length > 0) {
    p.log.info(c.yellow(`${noncatalogDeps.join(', ')} is not used in any catalog`))
    await runAgentRemove(noncatalogDeps, {
      cwd: workspace.getCwd(),
      agent: options.agent,
      recursive: isRecursive,
    })
  }

  return {
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}

async function selectCatalogs(depName: string, catalogDeps: RawDep[], options: CatalogOptions): Promise<string[]> {
  const catalogNames = [...new Set(catalogDeps.map(dep => dep.catalogName))]
  if (catalogNames.length <= 1 || options.yes)
    return catalogNames

  const selected = await p.multiselect({
    message: `${depName} found in multiple catalogs, please select the catalog to remove from`,
    options: catalogNames.map(catalogName => ({
      label: catalogName,
      value: catalogName,
    })),
    initialValues: catalogNames,
  })

  if (!selected || p.isCancel(selected))
    throw createCommandError(COMMAND_ERROR_CODES.ABORT)

  if (selected.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no catalog selected, aborting')

  return selected
}

function removeCatalogDepFromTargetPackages(
  targetPackages: PackageJsonMeta[],
  depName: string,
  catalogName: string,
  updatedPackages: Map<string, PackageJsonMeta>,
): void {
  for (const pkg of targetPackages) {
    for (const dep of pkg.deps) {
      if (dep.name !== depName)
        continue

      if (!isCatalogSpecifier(dep.specifier) || parseCatalogSpecifier(dep.specifier) !== catalogName)
        continue

      if (!updatedPackages.has(pkg.name))
        updatedPackages.set(pkg.name, cloneDeep(pkg))

      const updatedPackage = updatedPackages.get(pkg.name)!
      if (dep.source === 'pnpm.overrides') {
        delete ensurePnpmOverrides(updatedPackage.raw)[dep.name]
        continue
      }

      if (isPnpmOverridesPackageName(pkg.name))
        continue

      if (!isPackageJsonDepSource(dep.source))
        continue

      delete getPackageJsonDeps(updatedPackage.raw, dep.source)?.[dep.name]
    }
  }
}
