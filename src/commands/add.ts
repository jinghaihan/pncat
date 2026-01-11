import type {
  CatalogOptions,
  PackageJsonMeta,
  ParsedSpec,
  RawDep,
  ResolverContext,
  ResolverResult,
} from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { COMMON_DEPS_FIELDS } from '../constants'
import { normalizeCatalogName } from '../utils/catalog'
import { getDepSource } from '../utils/helper'
import { getLatestVersion } from '../utils/npm'
import { parseCommandOptions } from '../utils/process'
import { parseSpec } from '../utils/specifier'
import { confirmWorkspaceChanges, readPackageJSON } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function addCommand(options: CatalogOptions) {
  const args = process.argv.slice(3)
  if (args.length === 0) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const { pkgJson, pkgPath } = await readPackageJSON()
  const workspace = new Workspace(options)
  await workspace.catalog.ensureWorkspace()

  const { isDev = false, isPeer = false, isOptional = false, dependencies = [] } = await resolveAdd({
    args,
    options,
    workspace,
  })

  const depsSource = getDepSource(isDev, isOptional, isPeer)
  const deps = pkgJson[depsSource] ||= {}
  for (const dep of dependencies) {
    COMMON_DEPS_FIELDS.forEach((field) => {
      // In this case, the package is usually installed as a dev dependency,
      // but published as a peer or optional dependency.
      if (depsSource === 'devDependencies' && ['peerDependencies', 'optionalDependencies'].includes(field))
        return
      if (pkgJson[field]?.[dep.name])
        delete pkgJson[field][dep.name]
    })
    deps[dep.name] = dep.catalogName ? normalizeCatalogName(dep.catalogName) : dep.specifier || '^0.0.0'
  }

  const updatedPackages: Record<string, PackageJsonMeta> = {
    [pkgJson.name as string]: { filepath: pkgPath, raw: pkgJson } as PackageJsonMeta,
  }

  await confirmWorkspaceChanges(
    async () => {
      for (const dep of dependencies) {
        if (dep.catalogName)
          await workspace.catalog.setPackage(dep.catalogName, dep.name, dep.specifier || '^0.0.0')
      }
    },
    {
      workspace,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
      completeMessage: 'add complete',
    },
  )
}

export async function resolveAdd(context: ResolverContext): Promise<ResolverResult> {
  const { args = [], options, workspace } = context

  await workspace.loadPackages()

  const { deps, isDev, isOptional, isPeer, isExact } = parseCommandOptions(args, options)
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
      if (spec)
        dep.specifier = spec
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

    if (!dep.catalogName)
      dep.catalogName = options.catalog || workspace.inferCatalogName(createDep(dep))
  }

  return { isDev, isPeer, isOptional, dependencies: parsed.map(i => createDep(i)) }
}
