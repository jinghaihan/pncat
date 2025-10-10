import type { CatalogOptions } from '../types'
import type { ConfirmationOptions } from '../utils/workspace'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { CatalogManager } from '../catalog-manager'
import { ensureWorkspaceYAML, findWorkspaceYAML } from '../io/workspace'
import { resolveRevert } from '../utils/resolver'
import { confirmWorkspaceChanges, removeWorkspaceYAMLDeps } from '../utils/workspace'

export async function revertCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)

  const workspaceYamlPath = await findWorkspaceYAML(options.packageManager)
  if (!workspaceYamlPath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }

  const { workspaceYaml } = await ensureWorkspaceYAML(options.packageManager)
  const catalogManager = new CatalogManager(options)

  const { isRevertAll, dependencies = [], updatedPackages = {} } = await resolveRevert(args, {
    options,
    catalogManager,
    workspaceYaml,
  })

  const confirmationOptions: ConfirmationOptions = {
    catalogManager,
    workspaceYaml,
    workspaceYamlPath,
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
        const document = workspaceYaml.getDocument()
        document.deleteIn(['catalog'])
        document.deleteIn(['catalogs'])
      },
      confirmationOptions,
    )
  }
  else {
    await confirmWorkspaceChanges(
      async () => {
        removeWorkspaceYAMLDeps(dependencies, workspaceYaml)
      },
      confirmationOptions,
    )
  }
}
