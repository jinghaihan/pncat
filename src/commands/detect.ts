import type { CatalogOptions, PackageJsonMeta, PackageMeta, RawDep } from '@/types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { WorkspaceManager } from '@/workspace-manager'
import { resolveMigrate } from './migrate'
import { ensureWorkspaceFile, renderChanges } from './shared'

export async function detectCommand(options: CatalogOptions): Promise<void> {
  const workspace = new WorkspaceManager(options)
  await workspace.loadPackages()
  await ensureWorkspaceFile(workspace)

  const { dependencies, updatedPackages } = await resolveMigrate({
    options,
    workspace,
  })
  const deps = dependencies || []
  const nextUpdatedPackages = updatedPackages || {}
  const changedDeps = deps.filter(dep => dep.update)

  if (changedDeps.length === 0) {
    p.outro(c.yellow('no dependencies to migrate, aborting'))
    return
  }

  p.log.info(`found ${c.yellow(changedDeps.length)} dependencies to migrate`)

  const displayPackages = createDisplayPackages(
    changedDeps,
    nextUpdatedPackages,
    workspace.getPackages(),
  )

  let result = renderChanges(changedDeps, displayPackages)
  if (result) {
    result += `\nrun ${c.green('pncat migrate')}${options.force ? c.green(' -f') : ''} to apply changes`
    p.note(c.reset(result))
  }

  p.outro(c.green('detect complete'))
}

function createDisplayPackages(
  changedDeps: RawDep[],
  updatedPackages: Record<string, PackageJsonMeta>,
  packages: PackageMeta[],
): Record<string, PackageMeta> {
  const result: Record<string, PackageMeta> = { ...updatedPackages }
  if (changedDeps.length === 0)
    return result

  for (const pkg of packages) {
    if (result[pkg.name])
      continue

    const hasChangedDep = pkg.deps.some(dep =>
      changedDeps.some(changed => changed.name === dep.name && changed.source === dep.source),
    )
    if (!hasChangedDep)
      continue

    result[pkg.name] = pkg
  }

  return result
}
