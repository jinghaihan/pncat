import type { CatalogOptions, DepFilter, PnpmWorkspaceMeta, WorkspaceSchema } from '@/types'
import { YamlCatalog } from '@/catalog-handler/base/yaml-workspace'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { loadPackages } from '@/io'
import { createDepCatalogIndex, isCatalogSpecifier, isPnpmOverridesPackageName } from '@/utils'

export class PnpmCatalog extends YamlCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<PnpmWorkspaceMeta[] | null> {
    if (!relative.endsWith(PACKAGE_MANAGER_CONFIG.pnpm.filename))
      return null

    return await YamlCatalog.loadWorkspace(relative, { ...options, agent: 'pnpm' }, shouldCatalog) as PnpmWorkspaceMeta[]
  }

  constructor(options: CatalogOptions) {
    super(options, 'pnpm')
  }

  async updateWorkspaceOverrides(): Promise<void> {
    const packages = await loadPackages({ ...this.options, agent: 'pnpm' })
    const workspaceYaml = await this.getWorkspaceYaml()

    const overrides = packages.find(pkg => isPnpmOverridesPackageName(pkg.name))
    if (!overrides)
      return

    const rawWorkspaceJson = packages.find(pkg => pkg.name.startsWith('pnpm-catalog:'))?.raw as WorkspaceSchema | undefined
    const rawCatalogIndex = createDepCatalogIndex(rawWorkspaceJson)
    const catalogIndex = createDepCatalogIndex(workspaceYaml.toJSON() as WorkspaceSchema)

    const document = workspaceYaml.getDocument()
    for (const dep of overrides.deps) {
      const entries = catalogIndex.get(dep.name)
      const match = entries?.find(entry => entry.specifier === dep.specifier)
      if (match) {
        document.setIn(['overrides', dep.name], `catalog:${match.catalogName}`)
        continue
      }

      if (isCatalogSpecifier(dep.specifier)) {
        const catalogName = dep.specifier.replace('catalog:', '')
        const catalogMatch = entries?.find(entry => entry.catalogName === catalogName)
        if (catalogMatch) {
          document.setIn(['overrides', dep.name], `catalog:${catalogMatch.catalogName}`)
          continue
        }

        const rawEntries = rawCatalogIndex.get(dep.name)
        const rawMatch = rawEntries?.find(entry => entry.catalogName === catalogName)
        if (rawMatch) {
          const fallback = entries?.find(entry => entry.specifier === rawMatch.specifier)
          if (fallback)
            document.setIn(['overrides', dep.name], `catalog:${fallback.catalogName}`)
          else
            document.setIn(['overrides', dep.name], rawMatch.specifier)

          continue
        }
      }
    }
  }
}
