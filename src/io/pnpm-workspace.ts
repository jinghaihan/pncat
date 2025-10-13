import type { CatalogOptions, DepFilter, PnpmWorkspaceMeta } from '../types'
import { loadWorkspaceYaml } from './workspace-yaml'

export async function loadPnpmWorkspace(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<PnpmWorkspaceMeta[]> {
  return await loadWorkspaceYaml(relative, options, shouldCatalog) as PnpmWorkspaceMeta[]
}
