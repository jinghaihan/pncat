import type { CatalogOptions } from './core'
import type { RawDep, WorkspaceSchema } from './meta'

export interface CatalogEntry {
  catalogName: string
  specifier: string
}

export type CatalogIndex = Map<string, CatalogEntry[]>

export interface CatalogHandler {
  readonly options: CatalogOptions
  findWorkspaceFile: () => Promise<string | undefined>
  ensureWorkspace: () => Promise<void>
  toJSON: () => Promise<WorkspaceSchema>
  toString: () => Promise<string>
  setPackage: (catalog: 'default' | (string & {}), packageName: string, specifier: string) => Promise<void>
  removePackages: (deps: RawDep[]) => Promise<void>
  getPackageCatalogs: (name: string) => Promise<string[]>
  generateCatalogs: (deps: RawDep[]) => Promise<void>
  cleanupCatalogs: () => Promise<void>
  clearCatalogs: () => Promise<void>
  getWorkspacePath: () => Promise<string>
  writeWorkspace: () => Promise<void>
  updateWorkspaceOverrides?: () => Promise<void>
}
