import type { DepType } from './core'

export interface CatalogRule {
  name: string
  match: string | RegExp | (string | RegExp)[]
  depFields?: DepType[]
  priority?: number
  specifierRules?: SpecifierRule[]
}

export interface SpecifierRule {
  /**
   * Semver range, e.g., ">=3.0.0", "<3.0.0"
   */
  specifier: string
  /**
   * Specific packages this version range applies to.
   * If not specified, applies to all packages matched by the parent CatalogRule.
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
  = | '||'
    | '-'
    | '>='
    | '<='
    | '>'
    | '<'
    | 'x'
    | '*'
    | 'pre-release'
