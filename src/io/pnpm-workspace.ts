import type { CatalogOptions, DepFilter, PnpmWorkspaceMeta } from '../types'
import { loadWorkspace } from './workspace'

export async function loadPnpmWorkspace(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<PnpmWorkspaceMeta[]> {
  return await loadWorkspace(relative, options, shouldCatalog) as PnpmWorkspaceMeta[]
}
