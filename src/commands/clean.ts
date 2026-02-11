import type {
  CatalogOptions,
  RawDep,
  ResolverContext,
  ResolverResult,
} from '@/types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { WorkspaceManager } from '@/workspace-manager'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  createCommandError,
  ensureWorkspaceFile,
} from './shared'

export async function cleanCommand(options: CatalogOptions): Promise<void> {
  const workspace = new WorkspaceManager(options)
  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath)
    throw createCommandError(COMMAND_ERROR_CODES.NOT_FOUND, 'no workspace file found, aborting')

  await ensureWorkspaceFile(workspace)
  const { dependencies = [] } = await resolveClean({
    options,
    workspace,
  })

  if (dependencies.length === 0) {
    p.outro(c.yellow('no dependencies to clean, aborting'))
    return
  }

  p.log.info(`found ${c.yellow(dependencies.length)} dependencies not in package.json`)

  await confirmWorkspaceChanges(
    async () => {
      await workspace.catalog.removePackages(dependencies)
    },
    {
      workspace,
      yes: options.yes,
      verbose: options.verbose,
      bailout: true,
      completeMessage: 'clean complete',
    },
  )
}

export async function resolveClean(context: ResolverContext): Promise<ResolverResult> {
  const { options, workspace } = context
  const packages = await workspace.loadPackages()
  const projectPackages = packages.filter(pkg => pkg.type === 'package.json')
  const workspacePackages = packages.filter(pkg => pkg.type !== 'package.json')
  const dependencies: RawDep[] = []

  for (const pkg of workspacePackages) {
    for (const dep of pkg.deps) {
      if (workspace.isCatalogDependencyReferenced(dep.name, dep.catalogName, projectPackages))
        continue
      dependencies.push(dep)
    }
  }

  if (options.yes || dependencies.length === 0)
    return { dependencies }

  const uniqueDeps = dedupeDependencies(dependencies)
  const selected = await p.multiselect({
    message: 'please select dependencies to clean',
    options: uniqueDeps.map((dep, index) => ({
      label: `${dep.name} (${dep.catalogName})`,
      value: index,
      hint: dep.specifier,
    })),
    initialValues: Array.from({ length: uniqueDeps.length }, (_, index) => index),
  })

  if (p.isCancel(selected) || !selected)
    throw createCommandError(COMMAND_ERROR_CODES.ABORT)

  return {
    dependencies: uniqueDeps.filter((_, index) => selected.includes(index)),
  }
}

function dedupeDependencies(dependencies: RawDep[]): RawDep[] {
  const seen = new Set<string>()
  const unique: RawDep[] = []

  for (const dep of dependencies) {
    const key = `${dep.name}:${dep.catalogName}:${dep.specifier}`
    if (seen.has(key))
      continue

    seen.add(key)
    unique.push(dep)
  }

  return unique
}
