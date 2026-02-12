import type { DepType, PackageManager } from './core'
import type { WorkspaceSchema } from './meta'

export type WorkspaceDepType = `${PackageManager}-workspace`

export type PackageJsonDepSource = Exclude<DepType, 'pnpm.overrides' | WorkspaceDepType>

export interface PnpmConfig {
  overrides?: Record<string, string>
  [key: string]: unknown
}

export interface PackageJson extends WorkspaceSchema {
  name?: string
  version?: string
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  resolutions?: Record<string, string>
  pnpm?: PnpmConfig
  workspaces?:
    | string[]
    | {
      packages?: string[]
      nohoist?: string[]
      catalog?: Record<string, string>
      catalogs?: Record<string, Record<string, string>>
    }
  engines?: {
    vscode?: string
  }
  [key: string]: unknown
}
