import type { DepType } from './core'

export interface CatalogRule {
  name: string
  match: string | RegExp | (string | RegExp)[]
  depFields?: DepType[]
  priority?: number
  specifierRules?: SpecifierRule[]
}

export interface SpecifierRule {
  specifier: string
  match?: string | RegExp | (string | RegExp)[]
  name?: string
  suffix?: string
}

export interface SpecifierOptions {
  skipComplexRanges?: boolean
  allowPreReleases?: boolean
  allowWildcards?: boolean
  skipRangeTypes?: SpecifierRangeType[]
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
