import type { Workspace } from '../workspace-manager'
import type { CatalogOptions } from './core'
import type { RawDep, WorkspaceSchema } from './meta'

export interface CatalogHandler {
  readonly workspace: Workspace
  readonly options: CatalogOptions

  /**
   * Find the workspace file
   * @returns
   */
  findWorkspaceFile: () => Promise<string | undefined>

  /**
   * Ensure the workspace file exists
   */
  ensureWorkspace: () => Promise<void>

  /**
   * Convert the workspace to a JSON object
   */
  toJSON: () => Promise<WorkspaceSchema>

  /**
   * Convert the workspace to a string
   */
  toString: () => Promise<string>

  /**
   * Set a package to catalog
   */
  setPackage: (catalog: 'default' | (string & {}), packageName: string, specifier: string) => Promise<void>

  /**
   * Remove packages from the workspace
   */
  removePackages: (deps: RawDep[]) => Promise<void>

  /**
   * Get the catalogs for a package
   */
  getPackageCatalogs: (name: string) => Promise<string[]>

  /**
   * Generate the catalogs for a package
   */
  generateCatalogs: (deps: RawDep[]) => Promise<void>

  /**
   * Cleanup the catalogs
   */
  cleanupCatalogs: () => Promise<void>

  /**
   * Clear the catalogs
   */
  clearCatalogs: () => Promise<void>

  /**
   * Get the workspace path
   */
  getWorkspacePath: () => Promise<string>

  /**
   * Write the workspace
   */
  writeWorkspace: () => Promise<void>

  /**
   * Update the workspace overrides
   */
  updateWorkspaceOverrides?: () => Promise<void>

}
