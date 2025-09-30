import type { PackageJson } from 'pkg-types'
import type { PnpmWorkspaceYaml, PnpmWorkspaceYamlSchema } from 'pnpm-workspace-yaml'
import type { DepType } from './core'

export interface RawDep {
  name: string
  specifier: string
  source: DepType
  /**
   * Path of dependency in the package.json
   */
  parents?: string[]
  /**
   * Is the dependency a catalog
   */
  catalog: boolean
  /**
   * Is the dependency can be cataloged
   */
  catalogable: boolean
  /**
   * Inference catalog name by catalog rules
   */
  catalogName: string
  /**
   * Is the dependency updated by catalog rules
   */
  update?: boolean
}

export interface BasePackageMeta {
  /**
   * Package name
   */
  name: string
  /**
   * Is private package
   */
  private?: boolean
  /**
   * Package version
   */
  version?: string
  /**
   * Absolute filepath
   */
  filepath: string
  /**
   * Relative filepath to the root project
   */
  relative: string
  /**
   * Dependencies
   */
  deps: RawDep[]
}

export interface PackageJsonMeta extends BasePackageMeta {
  /**
   * Package type
   */
  type: 'package.json'
  /**
   * Raw package.json Object
   */
  raw: PackageJson
}

export interface PnpmWorkspaceMeta extends BasePackageMeta {
  type: 'pnpm-workspace.yaml'
  raw: PnpmWorkspaceYamlSchema
  context: PnpmWorkspaceYaml
}

export interface YarnWorkspaceMeta extends Omit<PnpmWorkspaceMeta, 'type'> {
  type: '.yarnrc.yml'
}

export type WorkspacePackageMeta = PnpmWorkspaceMeta | YarnWorkspaceMeta

export type PackageMeta = PackageJsonMeta | WorkspacePackageMeta

export interface ParsedSpec {
  name: string
  specifier?: string
  catalogName?: string
  specifierSource?: 'user' | 'catalog' | 'workspace' | 'npm'
}
