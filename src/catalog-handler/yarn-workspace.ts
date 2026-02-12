import type { CatalogOptions, DepFilter, YarnWorkspaceMeta } from '@/types'
import { YamlCatalog } from '@/catalog-handler/base'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'

export class YarnCatalog extends YamlCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<YarnWorkspaceMeta[] | null> {
    if (!relative.endsWith(PACKAGE_MANAGER_CONFIG.yarn.filename))
      return null

    return await YamlCatalog.loadWorkspace(relative, { ...options, agent: 'yarn' }, shouldCatalog) as YarnWorkspaceMeta[]
  }

  constructor(options: CatalogOptions) {
    super(options, 'yarn')
  }
}
