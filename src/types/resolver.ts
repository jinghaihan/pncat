import type { CatalogOptions } from './core'
import type { PackageJsonMeta, RawDep } from './meta'
import type { WorkspaceManager } from '@/workspace-manager'

export interface ResolverContext {
  args?: string[]
  options: CatalogOptions
  workspace: WorkspaceManager
}

export interface ResolverResult {
  isDev?: boolean
  isPeer?: boolean
  isOptional?: boolean
  isRevertAll?: boolean
  dependencies?: RawDep[]
  updatedPackages?: Record<string, PackageJsonMeta>
}
