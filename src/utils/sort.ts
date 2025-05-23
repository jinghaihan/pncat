import type { CatalogRule } from '../types'

export function sortCatalogRules(rules: CatalogRule[]) {
  return rules.sort((a, b) =>
    (a.priority ?? Infinity) - (b.priority ?? Infinity),
  )
}
