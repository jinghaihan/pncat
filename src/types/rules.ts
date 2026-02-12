import type { DepType } from './core'
import type { SPECIFIER_RANGE_TYPES } from '@/constants'

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

export type SpecifierRangeType = (typeof SPECIFIER_RANGE_TYPES)[number]
