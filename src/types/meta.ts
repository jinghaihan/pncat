import type { PnpmWorkspaceYaml, PnpmWorkspaceYamlSchema } from 'pnpm-workspace-yaml'
import type { DepType } from './core'
import type { PackageJson } from './package-json'

export type WorkspaceYaml = PnpmWorkspaceYaml

export type WorkspaceSchema = PnpmWorkspaceYamlSchema

export type WorkspaceType = 'pnpm-workspace.yaml' | '.yarnrc.yml' | 'bun-workspace'

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
  raw: WorkspaceSchema
  context: WorkspaceYaml
}

export interface YarnWorkspaceMeta extends Omit<PnpmWorkspaceMeta, 'type'> {
  type: '.yarnrc.yml'
}

export interface BunWorkspaceMeta extends BasePackageMeta {
  type: 'bun-workspace'
  raw: PackageJson
}

export type WorkspacePackageMeta = PnpmWorkspaceMeta | YarnWorkspaceMeta | BunWorkspaceMeta

export type PackageMeta = PackageJsonMeta | WorkspacePackageMeta

export interface ParsedSpec {
  name: string
  specifier?: string
  catalogName?: string
  specifierSource?: 'user' | 'catalog' | 'workspace' | 'npm'
}

export interface WorkspaceMeta {
  type: WorkspaceType
  lockFile: string | string[]
  defaultContent: string
}
