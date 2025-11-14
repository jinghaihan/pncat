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
import cloneDeep from 'lodash.clonedeep'
import { AGENT_CONFIG } from '../constants'
import { createDepCatalogIndex, inferCatalogName } from '../utils/catalog'
import { updatePackageToCatalog } from '../utils/helper'
import { sortSpecs } from '../utils/specifier'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function migrateCommand(options: CatalogOptions) {
  const workspace = new Workspace(options)
  await workspace.catalog.ensureWorkspace()

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

  const dependencies: Map<string, Map<string, RawDep[]>> = new Map()
  const updatedPackages: Map<string, PackageJsonMeta> = new Map()

  const setDep = (dep: RawDep) => {
    if (!dependencies.has(dep.name))
      dependencies.set(dep.name, new Map())
    const catalogDeps = dependencies.get(dep.name)!

    if (!catalogDeps.has(dep.catalogName))
      catalogDeps.set(dep.catalogName, [])
    catalogDeps.get(dep.catalogName)!.push(dep)
  }

  const setPackage = async (dep: RawDep, pkg: PackageJsonMeta) => {
    if (!updatedPackages.has(pkg.name))
      updatedPackages.set(pkg.name, cloneDeep(pkg))

    const data = updatedPackages.get(pkg.name)!
    await updatePackageToCatalog(dep, data, workspace)
  }

  for (const pkg of packages) {
    if (workspace.isCatalogPackage(pkg))
      continue
    for (const dep of pkg.deps) {
      if (!dep.catalogable)
        continue

      const resolvedDep = workspace.resolveDep(dep)
      setDep(resolvedDep)

      if (resolvedDep.update)
        await setPackage(resolvedDep, pkg)
    }
  }

  await resolveConflict(dependencies, options)

  const deps = Array.from(dependencies.values()).flatMap(i => Array.from(i.values()).flat())
  const exists = new Set(deps.map(i => i.name))

  const workspaceJson = await workspace.catalog.toJSON()
  const catalogIndex = createDepCatalogIndex(workspaceJson)
  const preserved: RawDep[] = []

  for (const [depName, catalogs] of catalogIndex.entries()) {
    if (exists.has(depName))
      continue

    for (const catalog of catalogs) {
      const rawDep = {
        name: depName,
        specifier: catalog.specifier,
        catalog: true,
        catalogable: true,
        catalogName: catalog.catalogName,
        source: AGENT_CONFIG[options.agent || 'pnpm'].depType,
      }
      if (options.force)
        rawDep.catalogName = inferCatalogName(rawDep, options)
      preserved.push(rawDep)
    }
  }

  return {
    dependencies: [...deps, ...preserved],
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}

export async function resolveConflict(dependencies: Map<string, Map<string, RawDep[]>>, options: CatalogOptions) {
  const conflicts: { depName: string, catalogName: string, specifiers: string[], resolvedSpecifier?: string }[] = []

  for (const [depName, catalogDeps] of dependencies) {
    for (const [catalogName, deps] of catalogDeps) {
      const specs = [...new Set(deps.map(i => i.specifier))]
      if (specs.length > 1) {
        const specifiers = sortSpecs(specs)
        conflicts.push({
          depName,
          catalogName,
          specifiers,
          resolvedSpecifier: specifiers[0],
        })
      }
      else {
        const dep = deps[0]
        dependencies.get(dep.name)!.set(dep.catalogName, [dep])
      }
    }
  }

  if (conflicts.length === 0)
    return

  p.log.warn(`📦 Found ${c.yellow(conflicts.length)} dependencies that need manual version selection`)
  for (const item of conflicts) {
    if (options.yes)
      continue

    const result = await p.select({
      message: c.yellow(`${item.depName} (${item.catalogName}):`),
      options: item.specifiers.map(i => ({
        label: i,
        value: i,
      })),
      initialValue: item.resolvedSpecifier,
    })
    if (!result || p.isCancel(result)) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }
    item.resolvedSpecifier = result
  }

  for (const conflict of conflicts) {
    const deps = dependencies.get(conflict.depName)!.get(conflict.catalogName)!
    const dep = deps.find(dep => dep.specifier === conflict.resolvedSpecifier)!
    dependencies.get(conflict.depName)!.set(conflict.catalogName, [dep])
  }
}
