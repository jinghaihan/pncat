import type { CatalogOptions, DepFilter, YarnWorkspaceMeta } from '../types'
import { loadWorkspaceYaml } from './workspace-yaml'

export async function loadYarnWorkspace(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<YarnWorkspaceMeta[]> {
  return await loadWorkspaceYaml(relative, options, shouldCatalog) as YarnWorkspaceMeta[]
}
