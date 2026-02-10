import type { DepType } from './core'
import type { WorkspacePackageMeta } from './meta'

export interface PackageManagerConfig {
  type: WorkspacePackageMeta['type']
  depType: DepType
  filename: string
  locks: string[]
  defaultContent: string
}
