import type { PnpmWorkspaceYaml, PnpmWorkspaceYamlSchema } from 'pnpm-workspace-yaml'
import type { CatalogManager } from '../catalog-manager'

interface CatalogEntry {
  catalogName: string
  specifier: string
}

function createCatalogIndex(workspaceJson?: PnpmWorkspaceYamlSchema) {
  const catalogIndex = new Map<string, CatalogEntry[]>()
  if (!workspaceJson)
    return catalogIndex

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

  return catalogIndex
}

export async function updatePnpmWorkspaceOverrides(workspaceYaml: PnpmWorkspaceYaml, catalogManager: CatalogManager) {
  const packages = await catalogManager.loadPackages()
  const overrides = packages.find(i => i.name === 'pnpm-workspace:overrides')
  if (!overrides)
    return

  const rawWorkspaceJson = packages.find(i => i.name.startsWith('pnpm-catalog:'))?.raw as PnpmWorkspaceYamlSchema
  const rawCatalogIndex = createCatalogIndex(rawWorkspaceJson)
  const catalogIndex = createCatalogIndex(workspaceYaml.toJSON())

  const document = workspaceYaml.getDocument()
  for (const dep of overrides.deps) {
    const entries = catalogIndex.get(dep.name)
    const match = entries?.find(i => i.specifier === dep.specifier)
    // if the specifier is already in the catalog, use the catalog name
    if (match) {
      document.setIn(['overrides', dep.name], `catalog:${match.catalogName}`)
      continue
    }

    if (dep.specifier.startsWith('catalog:')) {
      const catalogName = dep.specifier.replace('catalog:', '')
      const entries = catalogIndex.get(dep.name)
      const match = entries?.find(i => i.catalogName === catalogName)
      // update the specifier to the catalog name
      if (match) {
        document.setIn(['overrides', dep.name], `catalog:${match.catalogName}`)
        continue
      }

      const rawEntries = rawCatalogIndex.get(dep.name)
      const rawMatch = rawEntries?.find(i => i.catalogName === catalogName)
      if (rawMatch) {
        const catalog = entries?.find(i => i.specifier === rawMatch.specifier)
        if (catalog) { // update the catalog name
          document.setIn(['overrides', dep.name], `catalog:${catalog.catalogName}`)
          continue
        }
        else { // fallback to the raw version
          document.setIn(['overrides', dep.name], rawMatch.specifier)
          continue
        }
      }
    }
  }
}
