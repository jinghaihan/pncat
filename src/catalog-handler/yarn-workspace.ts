import type { CatalogOptions, DepFilter, YarnWorkspaceMeta } from '../types'
import { YamlCatalog } from './yaml-workspace'

export class YarnCatalog extends YamlCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<YarnWorkspaceMeta[]> {
    return await YamlCatalog.loadWorkspace(relative, options, shouldCatalog) as YarnWorkspaceMeta[]
  }
}
