import type { CatalogOptions } from '../types'
import type { ConfirmationOptions } from '../utils/workspace'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { resolveRevert } from '../utils/resolver'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function revertCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)

  const workspace = new Workspace(options)
  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }
  await workspace.catalog.ensureWorkspace()

  const { isRevertAll, dependencies = [], updatedPackages = {} } = await resolveRevert(args, {
    options,
    workspace,
  })

  const confirmationOptions: ConfirmationOptions = {
    workspace,
    updatedPackages,
    yes: options.yes,
    verbose: options.verbose,
    bailout: true,
    completeMessage: 'revert complete',
  }

  if (isRevertAll) {
    if (!options.yes) {
      const result = await p.confirm({
        message: c.green('all catalog dependencies will be reverted, are you sure?'),
      })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }

    await confirmWorkspaceChanges(
      async () => {
        await workspace.catalog.clearCatalogs()
      },
      { ...confirmationOptions, showDiff: false },
    )
  }
  else {
    await confirmWorkspaceChanges(
      async () => {
        await workspace.catalog.removePackages(dependencies)
      },
      confirmationOptions,
    )
  }
}
