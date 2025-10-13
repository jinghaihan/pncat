import type { CatalogOptions } from '../types'
import { resolveMigrate } from '../utils/resolver'
import { confirmWorkspaceChanges } from '../utils/workspace'
import { Workspace } from '../workspace-manager'

export async function migrateCommand(options: CatalogOptions) {
  const workspace = new Workspace(options)

  await workspace.catalog.ensureWorkspace()
  const { dependencies = [], updatedPackages = {} } = await resolveMigrate({
    options,
    workspace,
  })

  await confirmWorkspaceChanges(
    async () => {
      await workspace.catalog.generateCatalogs(dependencies)
    },
    {
      workspace,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: true,
      completeMessage: 'migrate complete',
    },
  )
}
