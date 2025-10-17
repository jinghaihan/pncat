import type { WorkspaceSchema } from '../types'

export function normalizeCatalogName(catalogName: string) {
  return catalogName === 'default' ? 'catalog:' : `catalog:${catalogName}`
}

export function getDepSource(isDev: boolean = false, isOptional: boolean = false, isPeer: boolean = false) {
  return isDev
    ? 'devDependencies'
    : isOptional
      ? 'optionalDependencies'
      : isPeer ? 'peerDependencies' : 'dependencies'
}

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
