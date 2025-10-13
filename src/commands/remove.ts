import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { resolveRemove } from '../utils/resolver'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function removeCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)
  if (args.length === 0) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const workspace = new Workspace(options)

  const { dependencies = [], updatedPackages = {} } = await resolveRemove(args, {
    options,
    workspace,
  })

  await confirmWorkspaceChanges(
    async () => {
      await workspace.catalog.removePackages(dependencies)
    },
    {
      workspace,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
      completeMessage: 'remove complete',
    },
  )
}
