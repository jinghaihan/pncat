import type { WorkspaceSchema } from '../types'

export function createCatalogIndex(workspaceJson?: WorkspaceSchema) {
  const catalogIndex = new Map<string, { catalogName: string, specifier: string }[]>()
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
