import type { WorkspaceSchema } from './meta'

export interface PackageJson extends WorkspaceSchema {
  name?: string
  version?: string
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
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
  [key: string]: any
}
