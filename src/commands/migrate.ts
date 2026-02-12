import type {
  CatalogIndex,
  CatalogOptions,
  PackageJsonMeta,
  RawDep,
  ResolverContext,
  ResolverResult,
} from '@/types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { gt } from 'semver'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { cleanSpec, toCatalogSpecifier } from '@/utils'
import { WorkspaceManager } from '@/workspace-manager'
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
  await workspace.loadPackages()
  const workspaceCatalogIndex = await workspace.getCatalogIndex()

  const groupedDeps = new Map<string, Map<string, RawDep[]>>()
  const updatedPackages = new Map<string, PackageJsonMeta>()

  for (const pkg of workspace.listCatalogTargetPackages()) {
    for (const dep of pkg.deps) {
      if (!dep.catalogable)
        continue

      const resolvedDep = workspace.resolveCatalogDep(dep, workspaceCatalogIndex, !!options.force)
      addDependency(groupedDeps, resolvedDep)

      if (resolvedDep.update && pkg.type === 'package.json')
        workspace.setDepSpecifier(updatedPackages, pkg, resolvedDep, toCatalogSpecifier(resolvedDep.catalogName))
    }
  }

  const dependencies = await resolveConflicts(groupedDeps, options)

  preserveWorkspaceDeps(dependencies, workspaceCatalogIndex, options)

  return {
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}

function addDependency(groupedDeps: Map<string, Map<string, RawDep[]>>, dep: RawDep): void {
  if (!groupedDeps.has(dep.name))
    groupedDeps.set(dep.name, new Map())

  const catalogDeps = groupedDeps.get(dep.name)!
  if (!catalogDeps.has(dep.catalogName))
    catalogDeps.set(dep.catalogName, [])

  catalogDeps.get(dep.catalogName)!.push(dep)
}

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

function preserveWorkspaceDeps(
  dependencies: RawDep[],
  catalogIndex: CatalogIndex,
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
