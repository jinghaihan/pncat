import type { CatalogOptions, DepFilter, PnpmWorkspaceMeta, WorkspaceSchema } from '../types'
import { createDepCatalogIndex, isCatalogSpecifier } from '../utils/catalog'
import { isPnpmOverridesPackageName } from '../utils/helper'
import { YamlCatalog } from './yaml-workspace'

export class PnpmCatalog extends YamlCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<PnpmWorkspaceMeta[]> {
    return await YamlCatalog.loadWorkspace(relative, options, shouldCatalog) as PnpmWorkspaceMeta[]
  }

  async updateWorkspaceOverrides(): Promise<void> {
    const packages = await this.workspace.loadPackages()
    const workspaceYaml = await this.getWorkspaceYaml()

    const overrides = packages.find(i => isPnpmOverridesPackageName(i.name))
    if (!overrides)
      return

    const rawWorkspaceJson = packages.find(i => i.name.startsWith('pnpm-catalog:'))?.raw as WorkspaceSchema
    const rawCatalogIndex = createDepCatalogIndex(rawWorkspaceJson)
    const catalogIndex = createDepCatalogIndex(workspaceYaml.toJSON())

    const document = workspaceYaml.getDocument()
    for (const dep of overrides.deps) {
      const entries = catalogIndex.get(dep.name)
      const match = entries?.find(i => i.specifier === dep.specifier)
      // if the specifier is already in the catalog, use the catalog name
      if (match) {
        document.setIn(['overrides', dep.name], `catalog:${match.catalogName}`)
        continue
      }

      if (isCatalogSpecifier(dep.specifier)) {
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
}
