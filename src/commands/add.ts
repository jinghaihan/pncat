import type {
  CatalogEntry,
  CatalogOptions,
  PackageJsonDepSource,
  PackageJsonMeta,
  ParsedSpec,
  RawDep,
  ResolverContext,
  ResolverResult,
} from '@/types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { relative } from 'pathe'
import { COMMON_DEPS_FIELDS } from '@/constants'
import {
  ensurePackageJsonDeps,
  getDepSource,
  getLatestVersion,
  inferCatalogName,
  isCatalogSpecifier,
  parseCatalogSpecifier,
  parseSpec,
  toCatalogSpecifier,
} from '@/utils'
import { WorkspaceManager } from '@/workspace-manager'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  createCommandError,
  ensureWorkspaceFile,
  parseCommandOptions,
  promptAdjustCatalogs,
  selectTargetProjectPackages,
} from './shared'

export async function addCommand(options: CatalogOptions): Promise<void> {
  const args = process.argv.slice(3)
  if (parseCommandOptions(args, options).deps.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

  const workspace = new WorkspaceManager(options)
  await ensureWorkspaceFile(workspace)
  await workspace.loadPackages()
  const targetPackages = await selectTargetProjectPackages({
    projectPackages: workspace.listProjectPackages(),
    currentPackagePath: workspace.resolveTargetProjectPackagePath(process.cwd()),
    promptMessage: `please select ${c.yellow('package.json')} files where dependencies will be added`,
    yes: options.yes,
  })

  const {
    isDev = false,
    isPeer = false,
    isOptional = false,
    dependencies = [],
  } = await resolveAdd({
    args,
    options,
    workspace,
    targetPackages,
  })

  const depSource = getDepSource(isDev, isOptional, isPeer)
  await confirmAddChanges({
    workspace,
    workspaceCwd: workspace.getCwd(),
    targetPackages,
    dependencies,
    depSource,
    options,
  })
}

export async function resolveAdd(context: ResolverContext & { targetPackages?: PackageJsonMeta[] }): Promise<ResolverResult> {
  const { args = [], options, workspace } = context
  await workspace.loadPackages()

  const { deps, isDev, isOptional, isPeer, isExact } = parseCommandOptions(args, options)
  if (deps.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

  const parsedDeps = deps
    .map(dep => dep.trim())
    .filter(Boolean)
    .map(dep => parseSpec(dep))

  const catalogIndex = await workspace.getCatalogIndex()
  const projectPackages = workspace.listProjectPackages()
  const workspacePackageNames = projectPackages.map(pkg => pkg.name)
  const targetPackages = context.targetPackages ?? projectPackages
  const source = getDepSource(isDev, isOptional, isPeer)

  for (const dep of parsedDeps) {
    await resolveDependencySpec(dep, {
      options,
      source,
      isExact,
      workspacePackageNames,
      catalogs: catalogIndex.get(dep.name) ?? [],
      targetPackages,
    })
  }

  return {
    isDev,
    isPeer,
    isOptional,
    dependencies: parsedDeps.map(dep => toRawDependency(dep, source, options)),
  }
}

async function confirmAddChanges(context: {
  workspace: WorkspaceManager
  workspaceCwd: string
  targetPackages: PackageJsonMeta[]
  dependencies: RawDep[]
  depSource: PackageJsonDepSource
  options: CatalogOptions
}): Promise<void> {
  const {
    workspace,
    workspaceCwd,
    targetPackages,
    dependencies,
    depSource,
    options,
  } = context
  const updatedPackages = createUpdatedPackages({
    targetPackages,
    dependencies,
    depSource,
    workspaceCwd,
  })

  await confirmWorkspaceChanges(
    async () => {
      for (const dep of dependencies)
        await workspace.catalog.setPackage(dep.catalogName, dep.name, dep.specifier || '^0.0.0')
    },
    {
      workspace,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
      completeMessage: 'add complete',
      onDeny: async () => {
        await promptAdjustCatalogs(dependencies)
        await confirmAddChanges(context)
      },
    },
  )
}

function createUpdatedPackages(context: {
  targetPackages: PackageJsonMeta[]
  dependencies: RawDep[]
  depSource: PackageJsonDepSource
  workspaceCwd: string
}): Record<string, PackageJsonMeta> {
  const {
    targetPackages,
    dependencies,
    depSource,
    workspaceCwd,
  } = context
  const updatedPackages: Record<string, PackageJsonMeta> = {}
  for (const targetPackage of targetPackages) {
    const updatedPackage = structuredClone(targetPackage)
    const deps = ensurePackageJsonDeps(updatedPackage.raw, depSource)

    for (const dep of dependencies) {
      for (const field of COMMON_DEPS_FIELDS) {
        if (depSource === 'devDependencies' && ['peerDependencies', 'optionalDependencies'].includes(field))
          continue

        if (updatedPackage.raw[field]?.[dep.name])
          delete updatedPackage.raw[field][dep.name]
      }

      deps[dep.name] = dep.catalogName ? toCatalogSpecifier(dep.catalogName) : dep.specifier || '^0.0.0'
    }

    updatedPackages[updatedPackage.filepath] = {
      ...updatedPackage,
      relative: relative(workspaceCwd, updatedPackage.filepath) || 'package.json',
    }
  }

  return updatedPackages
}

async function resolveDependencySpec(
  dep: ParsedSpec,
  context: {
    options: CatalogOptions
    source: ReturnType<typeof getDepSource>
    isExact: boolean
    workspacePackageNames: string[]
    catalogs: CatalogEntry[]
    targetPackages: PackageJsonMeta[]
  },
): Promise<void> {
  const { options, source, isExact, workspacePackageNames, catalogs, targetPackages } = context
  dep.catalogName ||= options.catalog || resolveExistingCatalogName(dep.name, source, catalogs, targetPackages)

  if (!dep.specifier && catalogs.length > 0) {
    dep.specifier = (catalogs.find(item => item.catalogName === dep.catalogName) ?? catalogs[0]).specifier
  }

  if (!dep.specifier && workspacePackageNames.includes(dep.name))
    dep.specifier = 'workspace:*'

  if (!dep.specifier) {
    const spinner = p.spinner({ indicator: 'dots' })
    spinner.start(`resolving ${c.cyan(dep.name)} from npm...`)

    const version = await getLatestVersion(dep.name)
    if (!version) {
      spinner.stop(`failed to resolve ${c.cyan(dep.name)} from npm`)
      throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'aborting')
    }

    dep.specifier = isExact ? version : `^${version}`
    spinner.stop(`${c.dim('resolved')} ${c.cyan(dep.name)}${c.dim(`@${c.green(dep.specifier)}`)}`)
  }

  if (!dep.catalogName)
    dep.catalogName = inferCatalogName(toRawDependency(dep, source, options), options)
}

function resolveExistingCatalogName(
  name: string,
  source: PackageJsonDepSource,
  catalogs: CatalogEntry[],
  targetPackages: PackageJsonMeta[],
): string | undefined {
  const catalogNames = new Set(catalogs.map(entry => entry.catalogName))
  if (catalogNames.size <= 1)
    return catalogs[0]?.catalogName

  const referenced = new Set<string>()
  for (const { raw } of targetPackages) {
    const currentSpecifier = raw[source]?.[name]
    if (currentSpecifier && isCatalogSpecifier(currentSpecifier)) {
      const currentCatalog = parseCatalogSpecifier(currentSpecifier)
      if (catalogNames.has(currentCatalog)) {
        referenced.add(currentCatalog)
        continue
      }
    }

    for (const field of COMMON_DEPS_FIELDS) {
      const specifier = raw[field]?.[name]
      if (specifier && isCatalogSpecifier(specifier)) {
        const catalogName = parseCatalogSpecifier(specifier)
        if (catalogNames.has(catalogName))
          referenced.add(catalogName)
      }
    }
  }

  if (referenced.size === 1)
    return [...referenced][0]

  throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, `${name} is in multiple catalogs, specify one with --catalog <name>`)
}

function toRawDependency(
  dep: ParsedSpec,
  source: ReturnType<typeof getDepSource>,
  options: CatalogOptions,
): RawDep {
  const specifier = dep.specifier || '^0.0.0'

  return {
    name: dep.name,
    specifier,
    source,
    parents: [],
    catalogable: true,
    catalogName: dep.catalogName || options.catalog || 'default',
    isCatalog: isCatalogSpecifier(specifier),
  }
}
