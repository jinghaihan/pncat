import type { CatalogRule } from '@/types'
import { toArray } from '@antfu/utils'
import deepmerge from 'deepmerge'
import { DEFAULT_CATALOG_RULES } from '@/rules'
import { cloneDeep, isObject } from './helper'

export interface MergeOptions {
  mergeDefaults?: boolean
  arrayMerge?: (target: CatalogRule[], source: CatalogRule[]) => CatalogRule[]
}

export function mergeCatalogRules(options: MergeOptions, ...rules: CatalogRule[][]): CatalogRule[]
export function mergeCatalogRules(...rules: CatalogRule[][]): CatalogRule[]

export function mergeCatalogRules(...args: (MergeOptions | CatalogRule[])[]): CatalogRule[] {
  const hasOptions = isObject(args[0])
  const options: MergeOptions = hasOptions
    ? (args[0] as MergeOptions)
    : { mergeDefaults: true }
  const rules = (hasOptions ? args.slice(1) : args) as CatalogRule[][]

  const { mergeDefaults = true, arrayMerge = mergeByName } = options
  const sources = mergeDefaults
    ? [cloneDeep(DEFAULT_CATALOG_RULES), ...rules]
    : [...rules]

  return sources.length === 0
    ? []
    : sortCatalogRules(deepmerge.all<CatalogRule[]>(sources, { arrayMerge }))
}

function mergeByName(target: CatalogRule[], source: CatalogRule[]): CatalogRule[] {
  const result = target.map(rule => cloneDeep(rule))

  for (const sourceRuleRaw of source) {
    const sourceRule = cloneDeep(sourceRuleRaw)
    const existing = result.find((entry: CatalogRule) => entry.name === sourceRule.name)
    if (!existing) {
      result.push(sourceRule)
      continue
    }

    const merged = deepmerge<CatalogRule>(
      {
        ...existing,
        match: toArray(existing.match),
      },
      {
        ...sourceRule,
        match: toArray(sourceRule.match),
      },
    )
    Object.assign(existing, merged)
  }

  return result
}

function sortCatalogRules(rules: CatalogRule[]): CatalogRule[] {
  return rules.sort((a, b) => (a.priority ?? Number.POSITIVE_INFINITY) - (b.priority ?? Number.POSITIVE_INFINITY))
}
