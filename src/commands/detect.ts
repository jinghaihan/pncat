import type { CatalogOptions } from '../types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { WorkspaceManager } from '../workspace-manager'
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

  let result = renderChanges(changedDeps, nextUpdatedPackages)
  if (result) {
    result += `\nrun ${c.green('pncat migrate')}${options.force ? c.green(' -f') : ''} to apply changes`
    p.note(c.reset(result))
  }

  p.outro(c.green('detect complete'))
}
