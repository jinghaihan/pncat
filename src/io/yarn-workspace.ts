import type { CatalogOptions, DepFilter, YarnWorkspaceMeta } from '../types'
import { loadWorkspace } from './workspace'

export async function loadYarnWorkspace(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<YarnWorkspaceMeta[]> {
  return await loadWorkspace(relative, options, shouldCatalog) as YarnWorkspaceMeta[]
}
