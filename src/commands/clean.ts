import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'
import { resolveClean } from './resolver'

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
