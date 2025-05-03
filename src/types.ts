import type { PackageJson } from 'pkg-types'
import type { PnpmWorkspaceYaml, PnpmWorkspaceYamlSchema } from 'pnpm-workspace-yaml'
import type { DEPS_FIELDS, MODE_CHOICES } from './constants'

export type RangeMode = typeof MODE_CHOICES[number]

export type DepType = typeof DEPS_FIELDS[number]

export type DepFieldOptions = Partial<Record<DepType, boolean>>

export interface CatalogRule {
  name: string
  match: string | RegExp | (string | RegExp)[]
  depFields?: DepType[]
}

export interface CommonOptions {
  cwd?: string
  recursive?: boolean
  force?: boolean
  ignorePaths?: string | string[]
  ignoreOtherWorkspaces?: boolean
  include?: string | string[]
  exclude?: string | string[]
  /**
   * Fields in package.json to be checked
   * By default all fields will be checked
   */
  depFields?: DepFieldOptions
  /**
   * Allowed protocols in specifier to not be converted to catalog
   */
  allowedProtocols: string[]
  /**
   * Rules to group and name dependencies in the catalog output
   */
  catalogRules?: CatalogRule[]
}

export interface CatalogOptions extends CommonOptions {
  mode?: RangeMode
  /**
   * Prompt for confirmation
   *
   * @default true
   */
  yes?: boolean
}

export interface RawDep {
  name: string
  specifier: string
  source: DepType
  parents?: string[]
  catalog: boolean
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

export type PackageMeta =
  | PackageJsonMeta
  | PnpmWorkspaceMeta
