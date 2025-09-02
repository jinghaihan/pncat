import type { CatalogOptions } from '../types'
import { ensureWorkspaceYAML } from '../io/workspace'
import { PnpmCatalogManager } from '../pnpm-catalog-manager'
import { resolveMigrate } from '../utils/resolver'
import { confirmWorkspaceChanges, generateWorkspaceYAML } from '../utils/workspace'

export async function migrateCommand(options: CatalogOptions) {
  const pnpmCatalogManager = new PnpmCatalogManager(options)

  const { dependencies = [], updatedPackages = {} } = await resolveMigrate({
    options,
    pnpmCatalogManager,
  })

  const { workspaceYaml, workspaceYamlPath } = await ensureWorkspaceYAML()

  await confirmWorkspaceChanges(
    async () => {
      generateWorkspaceYAML(dependencies, workspaceYaml)
    },
    {
      pnpmCatalogManager,
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
