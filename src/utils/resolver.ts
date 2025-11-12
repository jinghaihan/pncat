import type { CatalogOptions, PackageJsonMeta, ParsedSpec, RawDep } from '../types'
import type { Workspace } from '../workspace-manager'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { getDepSource, normalizeCatalogName } from './helper'
import { getLatestVersion } from './npm'
import { parseCommandOptions, runRemoveCommand } from './process'
import { parseSpec, sortSpecs } from './specifier'

interface ResolveContext {
  options: CatalogOptions
  workspace: Workspace
}

interface ResolveResult {
  isDev?: boolean
  isPeer?: boolean
  isOptional?: boolean
  isExact?: boolean
  isRevertAll?: boolean
  dependencies?: RawDep[]
  updatedPackages?: Record<string, PackageJsonMeta>
}

/**
 * Resolve the dependencies to add
 */
export async function resolveAdd(args: string[], context: ResolveContext): Promise<ResolveResult> {
  const { options, workspace } = context
  await workspace.loadPackages()

  const { deps, isDev, isOptional, isPeer, isExact } = parseCommandOptions(args)
  if (!deps.length) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const parsed: ParsedSpec[] = deps.map(x => x.trim()).filter(Boolean).map(parseSpec)
  const workspaceJson = await workspace.catalog.toJSON()
  const workspacePackages: string[] = workspace.getWorkspacePackages()

  const createDep = (dep: ParsedSpec): RawDep => {
    return {
      name: dep.name,
      specifier: dep.specifier,
      source: getDepSource(isDev, isOptional, isPeer),
      catalog: false,
      catalogable: true,
      catalogName: dep.catalogName,
    } as RawDep
  }

  for (const dep of parsed) {
    // If the dependency is a workspace package, set the specifier to workspace:*
    if (!dep.specifier && workspacePackages.includes(dep.name)) {
      dep.specifier = 'workspace:*'
      dep.specifierSource ||= 'workspace'
      continue
    }

    if (options.catalog)
      dep.catalogName ||= options.catalog

    if (dep.specifier)
      dep.specifierSource ||= 'user'

    if (!dep.specifier) {
      const catalogs = await workspace.catalog.getPackageCatalogs(dep.name)
      if (catalogs[0]) {
        dep.catalogName = catalogs[0]
        dep.specifierSource ||= 'catalog'
      }
    }

    if (dep.catalogName && !dep.specifier) {
      const spec = dep.catalogName === 'default'
        ? workspaceJson?.catalog?.[dep.name]
        : workspaceJson?.catalogs?.[dep.catalogName]?.[dep.name]
      if (spec) {
        dep.specifier = spec
      }
    }

    if (!dep.specifier) {
      const spinner = p.spinner({ indicator: 'dots' })
      spinner.start(`resolving ${c.cyan(dep.name)} from npm...`)
      const version = await getLatestVersion(dep.name)
      if (version) {
        dep.specifier = isExact ? version : `^${version}`
        dep.specifierSource ||= 'npm'
        spinner.stop(`${c.dim('resolved')} ${c.cyan(dep.name)}${c.dim(`@${c.green(dep.specifier)}`)}`)
      }
      else {
        spinner.stop(`failed to resolve ${c.cyan(dep.name)} from npm`)
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }

    if (!dep.catalogName) {
      dep.catalogName = options.catalog || workspace.inferCatalogName(createDep(dep))
    }
  }

  return { isDev, isPeer, isOptional, isExact, dependencies: parsed.map(i => createDep(i)) }
}

/**
 * Resolve the dependencies to clean
 */
export async function resolveClean(context: ResolveContext): Promise<ResolveResult> {
  const { workspace } = context

  const packages = await workspace.loadPackages()
  const dependencies: RawDep[] = []

  for (const pkg of packages) {
    if (pkg.type === 'package.json')
      continue
    for (const dep of pkg.deps) {
      const resolvedDep = workspace.resolveDep(dep, false)
      if (!workspace.isDepInPackage(resolvedDep)) {
        dependencies.push(resolvedDep)
      }
    }
  }

  return { dependencies }
}

/**
 * Resolve the dependencies to migrate
 */
export async function resolveMigrate(context: ResolveContext): Promise<ResolveResult> {
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

  const setPackage = (dep: RawDep, pkg: PackageJsonMeta) => {
    if (!updatedPackages.has(pkg.name))
      updatedPackages.set(pkg.name, structuredClone(pkg))

    const pkgJson = updatedPackages.get(pkg.name)!
    pkgJson.raw[dep.source][dep.name] = normalizeCatalogName(dep.catalogName)
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
        setPackage(resolvedDep, pkg)
    }
  }

  await resolveConflict(dependencies, options)

  return {
    dependencies: Array.from(dependencies.values()).flatMap(i => Array.from(i.values()).flat()),
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}

/**
 * Resolve the conflicts in the dependencies
 */
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

  for (const item of conflicts) {
    const deps = dependencies.get(item.depName)!.get(item.catalogName)!
    const dep = deps.find(dep => dep.specifier === item.resolvedSpecifier)!
    dependencies.get(item.depName)!.set(item.catalogName, [dep])
  }
}

/**
 * Resolve the dependencies to remove
 */
export async function resolveRemove(args: string[], context: ResolveContext): Promise<ResolveResult> {
  const { workspace } = context
  await workspace.loadPackages()

  const catalogOptions = workspace.getOptions()

  // must provide `--recursive` or `-r` to remove recursive
  const { deps, isRecursive } = parseCommandOptions(args)
  if (!deps.length) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    p.outro(c.red('no workspace file found'))
    await runRemoveCommand(deps, {
      cwd: process.cwd(),
      packageManager: catalogOptions.packageManager,
      recursive: isRecursive,
    })
    return { dependencies: [], updatedPackages: {} }
  }

  const unCatalogDeps: string[] = []
  const dependencies: RawDep[] = []
  const updatedPackages: Map<string, PackageJsonMeta> = new Map()

  for (const dep of deps) {
    const packages = workspace.getDepPackages(dep)
    if (!packages.length) {
      p.outro(c.red(`${dep} is not used in any package, aborting`))
      process.exit(1)
    }

    let catalogPkgs = packages.filter(i => workspace.isCatalogPackageName(i))

    // remove it from the package.json
    if (catalogPkgs.length === 0) {
      unCatalogDeps.push(dep)
    }

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
        const { catalogDeletable } = await workspace.removePackageDep(dep, rawDep.catalogName, isRecursive, updatedPackages)
        if (catalogDeletable)
          dependencies.push(rawDep)
      }
    }))
  }

  if (unCatalogDeps.length) {
    p.outro(c.yellow(`${unCatalogDeps.join(', ')} is not used in any catalog`))
    await runRemoveCommand(unCatalogDeps, {
      cwd: process.cwd(),
      packageManager: catalogOptions.packageManager,
      recursive: isRecursive,
    })
  }

  return {
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}

/**
 * Resolve the dependencies to revert
 */
export async function resolveRevert(args: string[], context: ResolveContext): Promise<ResolveResult> {
  const { workspace } = context

  const { deps } = parseCommandOptions(args)

  const depFilter = (depName: string) => {
    if (!deps.length)
      return true

    return deps.includes(depName)
  }

  const packages = await workspace.loadPackages()
  const dependencies: RawDep[] = []
  const updatedPackages: Map<string, PackageJsonMeta> = new Map()

  const setPackage = (dep: RawDep, pkg: PackageJsonMeta) => {
    if (!updatedPackages.has(pkg.name))
      updatedPackages.set(pkg.name, structuredClone(pkg))

    const pkgJson = updatedPackages.get(pkg.name)!
    pkgJson.raw[dep.source][dep.name] = dep.specifier
  }

  for (const pkg of packages) {
    if (workspace.isCatalogPackage(pkg))
      continue
    for (const dep of pkg.deps) {
      if (!depFilter(dep.name))
        continue

      const resolvedDep = workspace.resolveDep(dep)
      dependencies.push(resolvedDep)
      setPackage(resolvedDep, pkg)
    }
  }

  return {
    isRevertAll: !deps.length,
    dependencies,
    updatedPackages: Object.fromEntries(updatedPackages.entries()),
  }
}
