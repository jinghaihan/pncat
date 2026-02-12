import type {
  CatalogIndex,
  CatalogOptions,
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
  readWorkspacePackageJSON,
} from './shared'

export async function addCommand(options: CatalogOptions): Promise<void> {
  const args = process.argv.slice(3)
  if (args.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

  const workspace = new WorkspaceManager(options)
  await ensureWorkspaceFile(workspace)
  await workspace.loadPackages()

  const workspaceCwd = workspace.getCwd()
  const targetPackagePath = workspace.resolveTargetProjectPackagePath(process.cwd())
  const { pkgPath, pkgName, pkgJson } = await readWorkspacePackageJSON(workspace, targetPackagePath)
  const {
    isDev = false,
    isPeer = false,
    isOptional = false,
    dependencies = [],
  } = await resolveAdd({
    args,
    options,
    workspace,
  })

  const depSource = getDepSource(isDev, isOptional, isPeer)
  const deps = ensurePackageJsonDeps(pkgJson, depSource)

  for (const dep of dependencies) {
    for (const field of COMMON_DEPS_FIELDS) {
      if (depSource === 'devDependencies' && ['peerDependencies', 'optionalDependencies'].includes(field))
        continue

      if (pkgJson[field]?.[dep.name])
        delete pkgJson[field][dep.name]
    }

    deps[dep.name] = dep.catalogName ? toCatalogSpecifier(dep.catalogName) : dep.specifier || '^0.0.0'
  }

  await confirmWorkspaceChanges(
    async () => {
      for (const dep of dependencies)
        await workspace.catalog.setPackage(dep.catalogName, dep.name, dep.specifier || '^0.0.0')
    },
    {
      workspace,
      updatedPackages: {
        [pkgName]: {
          type: 'package.json',
          name: pkgName,
          private: !!pkgJson.private,
          version: typeof pkgJson.version === 'string' ? pkgJson.version : '',
          filepath: pkgPath,
          relative: relative(workspaceCwd, pkgPath) || 'package.json',
          raw: pkgJson,
          deps: [],
        },
      },
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
  if (deps.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies provided, aborting')

  const parsedDeps = deps
    .map(dep => dep.trim())
    .filter(Boolean)
    .map(dep => parseSpec(dep))

  const catalogIndex = await workspace.getCatalogIndex()
  const workspacePackageNames = workspace.listProjectPackages().map(pkg => pkg.name)
  const source = getDepSource(isDev, isOptional, isPeer)

  for (const dep of parsedDeps) {
    await resolveDependencySpec(dep, {
      options,
      source,
      isExact,
      workspacePackageNames,
      catalogIndex,
    })
  }

  return {
    isDev,
    isPeer,
    isOptional,
    dependencies: parsedDeps.map(dep => toRawDependency(dep, source, options)),
  }
}

async function resolveDependencySpec(
  dep: ParsedSpec,
  context: {
    options: CatalogOptions
    source: ReturnType<typeof getDepSource>
    isExact: boolean
    workspacePackageNames: string[]
    catalogIndex: CatalogIndex
  },
): Promise<void> {
  const { options, source, isExact, workspacePackageNames, catalogIndex } = context

  if (!dep.specifier && workspacePackageNames.includes(dep.name)) {
    dep.specifier = 'workspace:*'
    dep.specifierSource = 'workspace'
  }

  if (options.catalog)
    dep.catalogName ||= options.catalog

  if (dep.specifier)
    dep.specifierSource ||= 'user'

  if (!dep.specifier) {
    const catalogs = catalogIndex.get(dep.name) || []
    if (catalogs[0]) {
      dep.catalogName = dep.catalogName || catalogs[0].catalogName
      dep.specifier = catalogs.find(item => item.catalogName === dep.catalogName)?.specifier || catalogs[0].specifier
      dep.specifierSource = 'catalog'
    }
  }

  if (!dep.specifier) {
    const spinner = p.spinner({ indicator: 'dots' })
    spinner.start(`resolving ${c.cyan(dep.name)} from npm...`)

    const version = await getLatestVersion(dep.name)
    if (!version) {
      spinner.stop(`failed to resolve ${c.cyan(dep.name)} from npm`)
      throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'aborting')
    }

    dep.specifier = isExact ? version : `^${version}`
    dep.specifierSource = 'npm'
    spinner.stop(`${c.dim('resolved')} ${c.cyan(dep.name)}${c.dim(`@${c.green(dep.specifier)}`)}`)
  }

  if (!dep.catalogName)
    dep.catalogName = inferCatalogName(toRawDependency(dep, source, options), options)
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
