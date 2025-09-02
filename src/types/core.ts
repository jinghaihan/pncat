import type { DEPS_FIELDS, MODE_CHOICES } from '../constants'
import type { CatalogRule, SpecifierOptions } from './rules'

export type RangeMode = typeof MODE_CHOICES[number]

export type DepType = typeof DEPS_FIELDS[number]

export type DepFieldOptions = Partial<Record<DepType, boolean>>

export type DepFilter = (name: string, specifier: string) => boolean

export interface CommandOptions {
  cwd?: string
  mode?: RangeMode
  /**
   * Recursively search for package.json in subdirectories
   */
  recursive?: boolean
  /**
   * Force the execution of the command
   */
  force?: boolean
  /**
   * Prompt for confirmation
   */
  yes?: boolean
  /**
   * Run pnpm install after command
   */
  install?: boolean
  /**
   * Show complete pnpm-workspace.yaml instead of only the diff
   */
  verbose?: boolean
}

export interface ConfigOptions {
  /**
   * Only included dependencies will be checked for catalog
   */
  include?: string | string[]
  /**
   * Exclude dependencies to be checked, will override --include options
   */
  exclude?: string | string[]
  /**
   * Paths to ignore
   */
  ignorePaths?: string | string[]
  /**
   * Ignore other workspaces
   */
  ignoreOtherWorkspaces?: boolean
  /**
   * Install from a specific catalog, auto detect if not provided
   */
  catalog?: string
  /**
   * Fields in package.json to be checked
   * By default check `dependencies`, `devDependencies` and `peerDependencies`
   */
  depFields?: DepFieldOptions
  /**
   * Allowed protocols in specifier to not be converted to catalog
   */
  allowedProtocols?: string[]
}

export interface CatalogOptions extends CommandOptions, ConfigOptions {
  /**
   * Rules to group and name dependencies in the catalog output
   */
  catalogRules?: CatalogRule[]
  /**
   * Options to control how specifier ranges are processed
   */
  specifierOptions?: SpecifierOptions
}
