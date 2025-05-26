import type { CatalogRule } from '../types'
import deepmerge from 'deepmerge'
import { DEFAULT_CATALOG_RULES } from '../rules'

export interface MergeOptions {
  mergeDefaults?: boolean
  arrayMerge?: (target: any[], source: any[]) => any[]
}

export function mergeCatalogRules(options: MergeOptions, ...rules: CatalogRule[][]): CatalogRule[]
export function mergeCatalogRules(...rules: CatalogRule[][]): CatalogRule[]

export function mergeCatalogRules(
  ...args: (MergeOptions | CatalogRule[])[]
): CatalogRule[] {
  const hasOptions = typeof args[0] === 'object' && !Array.isArray(args[0])
  const options: MergeOptions = hasOptions
    ? (args[0] as MergeOptions)
    : { mergeDefaults: true }
  const rules = (hasOptions ? args.slice(1) : args) as CatalogRule[][]

  const { mergeDefaults = true, arrayMerge = mergeByName } = options

  const sources = mergeDefaults
    ? [DEFAULT_CATALOG_RULES, ...rules]
    : [...rules]

  return sources.length === 0
    ? []
    : deepmerge.all<CatalogRule[]>(sources, { arrayMerge })
}

function mergeByName(target: any[], source: any[]) {
  return source.reduce((result, item) => {
    const existing = result.find((x: any) => x.name === item.name)
    if (existing)
      Object.assign(existing, deepmerge(existing, item))
    else
      result.push(item)
    return result
  }, [...target])
}
