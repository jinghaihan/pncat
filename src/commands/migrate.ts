import type { CatalogOptions, PackageJsonMeta, RawDep, ResolverContext, ResolverResult } from '../types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { gt } from 'semver'
import { PACKAGE_MANAGER_CONFIG } from '../constants'
import {
  cleanSpec,
  cloneDeep,
  ensurePackageJsonDeps,
  ensurePnpmOverrides,
  isCatalogWorkspace,
  isPackageJsonDepSource,
  toCatalogSpecifier,
} from '../utils'
import { WorkspaceManager } from '../workspace-manager'
import { COMMAND_ERROR_CODES, confirmWorkspaceChanges, createCommandError, ensureWorkspaceFile } from './shared'

export async function migrateCommand(options: CatalogOptions): Promise<void> {
  const workspace = new WorkspaceManager(options)
  await ensureWorkspaceFile(workspace)

  const { dependencies = [], updatedPackages = {} } = await resolveMigrate({
    options,
    workspace,
  })

  await confirmWorkspaceChanges(
    async () => {
      await workspace.catalog.generateCatalogs(dependencies)
    },
    {
      workspace,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: true,
      completeMessage: 'migrate complete',
    },
  )
}

export async function resolveMigrate(context: ResolverContext): Promise<ResolverResult> {
  const { options, workspace } = context
  const packages = await workspace.loadPackages()
  const workspaceCatalogIndex = await workspace.getCatalogIndex()

  // groupedDeps: depName -> catalogName -> all observed dep entries
  const groupedDeps = new Map<string, Map<string, RawDep[]>>()
  // updatedPackages: packageName -> mutated package.json clone for pending writes
  const updatedPackages = new Map<string, PackageJsonMeta>()

  for (const pkg of packages) {
    if (pkg.type !== 'package.json')
      continue

    for (const dep of pkg.deps) {
      if (!dep.catalogable)
        continue

      const resolvedDep = workspace.resolveCatalogDependency(dep, workspaceCatalogIndex, !!options.force)
      addDependency(groupedDeps, resolvedDep)

      if (resolvedDep.update)
        updatePackageDep(updatedPackages, pkg, resolvedDep)
    }
  }

  const dependencies = await resolveConflicts(groupedDeps, options)

  preserveWorkspaceDeps(dependencies, workspaceCatalogIndex, options)

  return {
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}

// Append one resolved dependency into the in-memory grouping index.
function addDependency(groupedDeps: Map<string, Map<string, RawDep[]>>, dep: RawDep): void {
  if (!groupedDeps.has(dep.name))
    groupedDeps.set(dep.name, new Map())

  const catalogDeps = groupedDeps.get(dep.name)!
  if (!catalogDeps.has(dep.catalogName))
    catalogDeps.set(dep.catalogName, [])

  catalogDeps.get(dep.catalogName)!.push(dep)
}

// Stage one dependency rewrite in package.json to catalog:<name> form.
function updatePackageDep(
  updatedPackages: Map<string, PackageJsonMeta>,
  pkg: PackageJsonMeta,
  dep: RawDep,
): void {
  const packageName = pkg.name
  if (!updatedPackages.has(packageName))
    updatedPackages.set(packageName, cloneDeep(pkg))

  const updatedPackage = updatedPackages.get(packageName)!
  const nextSpecifier = toCatalogSpecifier(dep.catalogName)

  if (dep.source === 'pnpm.overrides') {
    ensurePnpmOverrides(updatedPackage.raw)[dep.name] = nextSpecifier
    return
  }

  if (isCatalogWorkspace(dep.source))
    return

  if (!isPackageJsonDepSource(dep.source))
    return

  ensurePackageJsonDeps(updatedPackage.raw, dep.source)[dep.name] = nextSpecifier
}

// Resolve same-package conflicts where one dep/catalog pair has multiple specifiers.
async function resolveConflicts(
  groupedDeps: Map<string, Map<string, RawDep[]>>,
  options: CatalogOptions,
): Promise<RawDep[]> {
  const dependencies: RawDep[] = []
  const conflictCount = countConflicts(groupedDeps)

  if (conflictCount > 0)
    p.log.warn(`found ${c.yellow(conflictCount)} dependencies with multiple specifiers, manual selection required`)

  for (const [, catalogDeps] of groupedDeps) {
    for (const [catalogName, deps] of catalogDeps) {
      const specifiers = [...new Set(deps.map(dep => dep.specifier))]
      if (specifiers.length <= 1) {
        dependencies.push(deps[0])
        continue
      }

      const selectedSpecifier = await selectSpecifier(specifiers, deps[0].name, catalogName, options)

      const selectedDep = deps.find(dep => dep.specifier === selectedSpecifier)!
      dependencies.push(selectedDep)
    }
  }

  return dependencies
}

// Count how many dep/catalog groups need conflict resolution.
function countConflicts(groupedDeps: Map<string, Map<string, RawDep[]>>): number {
  let total = 0
  for (const [, catalogDeps] of groupedDeps) {
    for (const [, deps] of catalogDeps) {
      const specifiers = new Set(deps.map(dep => dep.specifier))
      if (specifiers.size > 1)
        total += 1
    }
  }
  return total
}

// Pick one preferred specifier (semver-aware, highest first when comparable).
async function selectSpecifier(
  specifiers: string[],
  depName: string,
  catalogName: string,
  options: CatalogOptions,
): Promise<string> {
  const sorted = specifiers.slice().sort((a, b) => {
    const versionA = cleanSpec(a, options)
    const versionB = cleanSpec(b, options)

    if (versionA && versionB) {
      if (versionA === versionB)
        return 0
      return gt(versionA, versionB) ? -1 : 1
    }

    return a.localeCompare(b)
  })

  const selected = await p.select({
    message: `select specifier for ${depName} (${catalogName})`,
    options: sorted.map(specifier => ({
      label: specifier,
      value: specifier,
    })),
    initialValue: sorted[0],
  })

  if (p.isCancel(selected))
    throw createCommandError(COMMAND_ERROR_CODES.ABORT)

  return selected
}

// Keep existing workspace catalog entries that are not referenced by current packages.
function preserveWorkspaceDeps(
  dependencies: RawDep[],
  catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
  options: CatalogOptions,
): void {
  const usedDeps = new Set(dependencies.map(dep => dep.name))
  const agent = options.agent || 'pnpm'

  for (const [depName, catalogs] of catalogIndex.entries()) {
    if (usedDeps.has(depName))
      continue

    for (const catalog of catalogs) {
      dependencies.push({
        name: depName,
        specifier: catalog.specifier,
        source: PACKAGE_MANAGER_CONFIG[agent].depType,
        parents: [],
        catalogable: true,
        catalogName: catalog.catalogName,
        isCatalog: true,
      })
    }
  }
}
