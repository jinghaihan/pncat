import type { CatalogRule } from '../types'
import { toArray } from '@antfu/utils'
import deepmerge from 'deepmerge'
import { DEFAULT_CATALOG_RULES } from '../rules'

export interface MergeOptions {
  mergeDefaults?: boolean
  arrayMerge?: (target: CatalogRule[], source: CatalogRule[]) => CatalogRule[]
}

export function mergeCatalogRules(options: MergeOptions, ...rules: CatalogRule[][]): CatalogRule[]
export function mergeCatalogRules(...rules: CatalogRule[][]): CatalogRule[]

export function mergeCatalogRules(...args: (MergeOptions | CatalogRule[])[]): CatalogRule[] {
  const hasOptions = typeof args[0] === 'object' && !Array.isArray(args[0])
  const options: MergeOptions = hasOptions
    ? (args[0] as MergeOptions)
    : { mergeDefaults: true }
  const rules = (hasOptions ? args.slice(1) : args) as CatalogRule[][]

  const { mergeDefaults = true, arrayMerge = mergeByName } = options

  const sources = mergeDefaults
    ? [structuredClone(DEFAULT_CATALOG_RULES), ...rules]
    : [...rules]

  return sources.length === 0
    ? []
    : sortCatalogRules(deepmerge.all<CatalogRule[]>(sources, { arrayMerge }))
}

function mergeByName(target: CatalogRule[], source: CatalogRule[]) {
  return source.reduce((result, item) => {
    const existing = result.find((x: CatalogRule) => x.name === item.name)
    if (existing) {
      existing.match = toArray(existing.match)
      item.match = toArray(item.match)
      Object.assign(existing, deepmerge(existing, item))
    }
    else {
      result.push(item)
    }
    return result
  }, [...target])
}

function sortCatalogRules(rules: CatalogRule[]): CatalogRule[] {
  return rules.sort((a, b) =>
    (a.priority ?? Infinity) - (b.priority ?? Infinity),
  )
}
