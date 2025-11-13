import type { AGENTS, DEPS_FIELDS, MODE_CHOICES } from '../constants'
import type { CatalogRule, SpecifierOptions } from './rules'

export type RangeMode = typeof MODE_CHOICES[number]

export type DepType = typeof DEPS_FIELDS[number]

export type Agent = typeof AGENTS[number]

export type DepFieldOptions = Partial<Record<DepType, boolean>>

export type DepFilter = (name: string, specifier: string) => boolean

export interface CommandOptions {
  cwd?: string
  mode?: RangeMode
  /**
   * Recursively search for package.json in subdirectories
   * @default true
   */
  recursive?: boolean
  /**
   * Force the execution of the command
   * @default false
   */
  force?: boolean
  /**
   * Install from a specific catalog, auto detect if not provided
   */
  catalog?: string
  /**
   * Prompt for confirmation
   * @default true
   */
  yes?: boolean
  /**
   * Run install after command
   * @default true
   */
  install?: boolean
  /**
   * Show complete catalogs instead of only the diff
   * @default false
   */
  verbose?: boolean
}

export interface ConfigOptions {
  agent?: Agent
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
   * @default true
   */
  ignoreOtherWorkspaces?: boolean
  /**
   * Fields in package.json to be checked
   * By default check `dependencies`, `devDependencies` and `peerDependencies`
   */
  depFields?: DepFieldOptions
  /**
   * Allowed protocols in specifier to not be converted to catalog
   */
  allowedProtocols?: string[]
  /**
   * Save exact version of the dependency
   * @default false
   */
  saveExact?: boolean
  /**
   * Hook to run after command completion
   * Can be a shell command string or a function
   */
  postRun?: string | HookFunction | Array<string | HookFunction>
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

export type HookFunction = () => Promise<void> | void
