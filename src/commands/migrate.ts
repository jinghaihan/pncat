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
import { isGreater } from 'verkit'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { cleanSpec, inferCatalogName, toCatalogSpecifier } from '@/utils'
import { WorkspaceManager } from '@/workspace-manager'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  createCommandError,
  ensureWorkspaceFile,
  promptAdjustCatalogs,
} from './shared'

export async function migrateCommand(options: CatalogOptions): Promise<void> {
  const workspace = new WorkspaceManager(options)
  await ensureWorkspaceFile(workspace)

  const { dependencies = [] } = await resolveMigrate({
    options,
    workspace,
  })

  await confirmMigrateChanges({
    workspace,
    dependencies,
    options,
  })
}

export async function resolveMigrate(context: ResolverContext): Promise<ResolverResult> {
  const { options, workspace } = context
  await workspace.loadPackages()
  const workspaceCatalogIndex = await workspace.getCatalogIndex()

  const groupedDeps = new Map<string, Map<string, RawDep[]>>()

  for (const pkg of workspace.listCatalogTargetPackages()) {
    for (const dep of pkg.deps) {
      if (!dep.catalogable)
        continue

      const resolvedDep = workspace.resolveCatalogDep(dep, workspaceCatalogIndex, !!options.force)
      addDependency(groupedDeps, resolvedDep)
    }
  }

  const dependencies = await resolveConflicts(groupedDeps, options)

  preserveWorkspaceDeps(dependencies, workspaceCatalogIndex, options)

  return {
    dependencies,
    updatedPackages: await createMigrateUpdatedPackages({
      workspace,
      dependencies,
      options,
    }),
  }
}

async function confirmMigrateChanges(context: {
  workspace: WorkspaceManager
  dependencies: RawDep[]
  options: CatalogOptions
}): Promise<void> {
  const { workspace, dependencies, options } = context
  const updatedPackages = await createMigrateUpdatedPackages({
    workspace,
    dependencies,
    options,
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
      onDeny: async () => {
        await promptAdjustCatalogs(dependencies)
        await confirmMigrateChanges(context)
      },
    },
  )
}

async function createMigrateUpdatedPackages(context: {
  workspace: WorkspaceManager
  dependencies: RawDep[]
  options: CatalogOptions
}): Promise<Record<string, PackageJsonMeta>> {
  const { workspace, dependencies, options } = context
  const catalogIndex = await workspace.getCatalogIndex()
  const dependenciesByName = groupDependenciesByName(dependencies)
  const updatedPackages = new Map<string, PackageJsonMeta>()

  for (const pkg of workspace.listProjectPackages()) {
    for (const dep of pkg.deps) {
      if (!dep.catalogable)
        continue

      const targetDep = resolveMigrateTargetDep(
        workspace.resolveCatalogDep(dep, catalogIndex, !!options.force),
        dependenciesByName.get(dep.name) || [],
      )
      if (!targetDep)
        continue

      const specifier = toCatalogSpecifier(targetDep.catalogName)
      if (dep.specifier === specifier)
        continue

      workspace.setDepSpecifier(updatedPackages, pkg, dep, specifier)
    }
  }

  return Object.fromEntries(updatedPackages.entries())
}

function groupDependenciesByName(dependencies: RawDep[]): Map<string, RawDep[]> {
  const result = new Map<string, RawDep[]>()

  for (const dep of dependencies)
    result.set(dep.name, [...(result.get(dep.name) || []), dep])

  return result
}

function resolveMigrateTargetDep(resolvedDep: RawDep, dependencies: RawDep[]): RawDep | undefined {
  if (dependencies.length <= 1)
    return dependencies[0]

  return dependencies.find(dep =>
    dep.catalogName === resolvedDep.catalogName
    && dep.specifier === resolvedDep.specifier,
  ) || dependencies.find(dep =>
    dep.catalogName === resolvedDep.catalogName,
  ) || dependencies.find(dep =>
    dep.specifier === resolvedDep.specifier,
  )
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
        dependencies.push(selectPreferredDependency(deps))
        continue
      }

      const selectedSpecifier = await selectSpecifier(specifiers, deps[0].name, catalogName, options)
      const selectedDep = selectPreferredDependency(deps, dep => dep.specifier === selectedSpecifier)
      dependencies.push(selectedDep)
    }
  }

  return dependencies
}

function selectPreferredDependency(deps: RawDep[], matcher?: (dep: RawDep) => boolean): RawDep {
  const matched = matcher ? deps.filter(matcher) : deps
  if (matched.length === 0)
    return deps[0]

  return matched.find(dep => dep.update) || matched[0]
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
  const sorted = specifiers.toSorted((a, b) => {
    const versionA = cleanSpec(a, options)
    const versionB = cleanSpec(b, options)

    if (versionA && versionB) {
      if (versionA === versionB)
        return 0
      return isGreater(versionA, versionB) ? -1 : 1
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
      const source = PACKAGE_MANAGER_CONFIG[agent].depType
      const catalogName = options.force
        ? inferCatalogName(
            {
              name: depName,
              specifier: catalog.specifier,
              source,
              parents: [],
              catalogable: true,
              isCatalog: true,
            },
            options,
          )
        : catalog.catalogName

      dependencies.push({
        name: depName,
        specifier: catalog.specifier,
        source,
        parents: [],
        catalogable: true,
        catalogName,
        isCatalog: true,
      })
    }
  }
}
