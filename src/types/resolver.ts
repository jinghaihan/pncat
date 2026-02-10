import type { CatalogOptions } from './core'
import type { PackageJsonMeta, RawDep } from './meta'

export interface ResolverContext {
  args?: string[]
  options: CatalogOptions
}

export interface ResolverResult {
  isDev?: boolean
  isPeer?: boolean
  isOptional?: boolean
  isRevertAll?: boolean
  dependencies?: RawDep[]
  updatedPackages?: Record<string, PackageJsonMeta>
}
