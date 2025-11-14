import type { CatalogOptions, RawDep, ResolverContext, ResolverResult } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function cleanCommand(options: CatalogOptions) {
  const workspace = new Workspace(options)

  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }

  const { dependencies = [] } = await resolveClean({
    options,
    workspace,
  })

  if (!dependencies.length) {
    p.outro(c.yellow('no dependencies to clean, aborting'))
    process.exit(0)
  }

  await workspace.catalog.ensureWorkspace()
  p.log.info(`📦 Found ${c.yellow(dependencies.length)} dependencies not in package.json`)

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
  const dependencies: RawDep[] = []

  for (const pkg of packages) {
    if (pkg.type === 'package.json')
      continue
    for (const dep of pkg.deps) {
      const resolvedDep = workspace.resolveDep(dep, false)
      if (!workspace.isDepInPackage(resolvedDep) && !workspace.isDepInPnpmOverrides(resolvedDep))
        dependencies.push(resolvedDep)
    }
  }

  if (options.yes || !dependencies.length)
    return { dependencies }

  const cache = new Set<string>()
  const deps: RawDep[] = []
  for (const dep of dependencies) {
    const key = `${dep.name}.${dep.catalogName}.${dep.specifier}`
    if (cache.has(key))
      continue
    cache.add(key)
    deps.push(dep)
  }

  const choices = await p.multiselect({
    message: 'please select the dependencies to clean',
    options: deps.map((dep, index) => ({
      label: `${dep.name} (${dep.catalogName})`,
      value: index,
      hint: dep.specifier,
    })),
    initialValues: Array.from({ length: deps.length }, (_, index) => index),
  })
  if (p.isCancel(choices) || !choices) {
    p.outro(c.red('aborting'))
    process.exit(1)
  }

  return {
    dependencies: deps.filter((_, index) => choices.includes(index)),
  }
}
