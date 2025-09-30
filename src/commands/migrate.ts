import type { CatalogOptions } from '../types'
import { CatalogManager } from '../catalog-manager'
import { ensureWorkspaceYAML } from '../io/workspace'
import { resolveMigrate } from '../utils/resolver'
import { confirmWorkspaceChanges, generateWorkspaceYAML } from '../utils/workspace'

export async function migrateCommand(options: CatalogOptions) {
  const catalogManager = new CatalogManager(options)

  const { dependencies = [], updatedPackages = {} } = await resolveMigrate({
    options,
    catalogManager,
  })

  const { workspaceYaml, workspaceYamlPath } = await ensureWorkspaceYAML(options.packageManager)

  await confirmWorkspaceChanges(
    async () => {
      generateWorkspaceYAML(dependencies, workspaceYaml)
    },
    {
      catalogManager,
      workspaceYaml,
      workspaceYamlPath,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: true,
      completeMessage: 'migrate complete',
    },
  )
}
