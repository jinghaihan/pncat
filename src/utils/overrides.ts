import type { PnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import type { CatalogManager } from '../catalog-manager'

interface CatalogEntry {
  catalogName: string
  specifier: string
}

export async function updateWorkspaceOverrides(workspaceYaml: PnpmWorkspaceYaml, catalogManager: CatalogManager) {
  const workspaceJson = workspaceYaml.toJSON()

  const packages = await catalogManager.loadPackages()
  const overrides = packages.find(i => i.name === 'pnpm-workspace:overrides')
  if (!overrides)
    return

  const catalogIndex = new Map<string, CatalogEntry[]>()
  if (workspaceJson.catalog) {
    for (const [depName, specifier] of Object.entries(workspaceJson.catalog)) {
      if (!catalogIndex.has(depName))
        catalogIndex.set(depName, [])

      catalogIndex.get(depName)?.push({
        catalogName: 'default',
        specifier,
      })
    }
  }
  if (workspaceJson.catalogs) {
    for (const [catalogName, catalog] of Object.entries(workspaceJson.catalogs)) {
      if (catalog) {
        for (const [depName, specifier] of Object.entries(catalog)) {
          if (!catalogIndex.has(depName))
            catalogIndex.set(depName, [])

          catalogIndex.get(depName)?.push({
            catalogName,
            specifier,
          })
        }
      }
    }
  }

  const document = workspaceYaml.getDocument()
  for (const dep of overrides.deps) {
    const entries = catalogIndex.get(dep.name)
    const match = entries?.find(i => i.specifier === dep.specifier)
    if (match) {
      document.setIn(['overrides', dep.name], `catalog:${match.catalogName}`)
    }
  }
}
