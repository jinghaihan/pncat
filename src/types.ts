import type { PackageJson } from 'pkg-types'
import type { PnpmWorkspaceYaml, PnpmWorkspaceYamlSchema } from 'pnpm-workspace-yaml'
import type { DEPS_FIELDS, MODE_CHOICES } from './constants'

export type RangeMode = typeof MODE_CHOICES[number]

export type DepType = typeof DEPS_FIELDS[number]

export type DepFieldOptions = Partial<Record<DepType, boolean>>

export interface SpecifierRule {
  /**
   * Semver range, e.g., ">=3.0.0", "<3.0.0"
   */
  specifier: string
  /**
   * Specific packages this version range applies to.
   * If not specified, applies to all packages matched by the parent CatalogRule.
   * Supports same format as CatalogRule.match: string, RegExp, or array of both.
   */
  match?: string | RegExp | (string | RegExp)[]
  /**
   * Complete catalog name, takes priority over suffix
   */
  name?: string
  /**
   * Catalog suffix, e.g., "v3", "v2"
   */
  suffix?: string
}

export interface CatalogRule {
  name: string
  match: string | RegExp | (string | RegExp)[]
  depFields?: DepType[]
  priority?: number
  specifierRules?: SpecifierRule[]
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
  /**
   * Options to control how specifier ranges are processed
   */
  specifierOptions?: SpecifierOptions
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

export type PackageMeta = PackageJsonMeta | PnpmWorkspaceMeta

export interface SpecifierOptions {
  /**
   * Whether to skip complex version ranges (e.g., "||", "-", ">=16.0.0")
   * @default true
   */
  skipComplexRanges?: boolean
  /**
   * List of specific range types to skip (overrides skipComplexRanges)
   * Example: ["||", "-", ">=", "<", "x", "*", "pre-release"]
   */
  skipRangeTypes?: SpecifierRangeType[]
  /**
   * Whether to allow pre-release versions (e.g., "4.0.0-beta")
   * @default true
   */
  allowPreReleases?: boolean
  /**
   * Whether to allow wildcard versions (e.g., "3.x", "*")
   * @default false
   */
  allowWildcards?: boolean
}

export type SpecifierRangeType
  = | '||' // Logical OR (e.g., "^3.0.0 || ^4.0.0")
    | '-' // Hyphen range (e.g., "1.2.3 - 2.3.4")
    | '>=' // Greater than or equal
    | '<=' // Less than or equal
    | '>' // Greater than
    | '<' // Less than
    | 'x' // Wildcard (e.g., "3.x")
    | '*' // Any version
    | 'pre-release' // Beta/alpha/rc versions (e.g., "4.0.0-beta")

export interface ParsedSpec {
  name: string
  specifier?: string
  catalog?: string
  specifierSource?: 'user' | 'catalog' | 'workspace' | 'npm'
}
