import type { CatalogOptions, PackageJsonMeta, PackageMeta, RawDep } from '@/types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { WorkspaceManager } from '@/workspace-manager'
import { resolveMigrate } from './migrate'
import { renderChanges } from './shared'

export async function detectCommand(options: CatalogOptions): Promise<void> {
  const workspace = new WorkspaceManager(options)
  const workspaceFilepath = await workspace.catalog.findWorkspaceFile()
  if (!workspaceFilepath) {
    const agent = options.agent || 'pnpm'
    const filename = PACKAGE_MANAGER_CONFIG[agent].filename
    p.outro(c.yellow(`no ${filename} found, aborting`))
    return
  }

  await workspace.loadPackages()
  await workspace.catalog.ensureWorkspace()

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
  const addedFilepaths = new Set(Object.values(result).map(pkg => pkg.filepath))
  if (changedDeps.length === 0)
    return result

  for (const pkg of packages) {
    if (addedFilepaths.has(pkg.filepath))
      continue

    if (pkg.type === 'package.json')
      continue

    const isWorkspaceOverridesPackage = pkg.name.endsWith('-workspace:overrides')
    const hasChangedDep = pkg.deps.some(dep =>
      changedDeps.some(changed =>
        changed.name === dep.name
        && (changed.source === dep.source || isWorkspaceOverridesPackage),
      ),
    )
    if (!hasChangedDep)
      continue

    result[pkg.filepath] = pkg
    addedFilepaths.add(pkg.filepath)
  }

  return result
}
