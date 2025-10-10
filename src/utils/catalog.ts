import type { CatalogOptions, RawDep } from '../types'
import { satisfies } from 'semver'
import { DEP_TYPE_GROUP_NAME_MAP } from '../constants'
import { cleanSpec, mostSpecificRule } from './specifier'

export function isDepMatched(depName: string, match: string | RegExp | (string | RegExp)[]): boolean {
  if (Array.isArray(match)) {
    return match.some(m => (typeof m === 'string' ? depName === m : m.test(depName)))
  }
  else if (typeof match === 'string') {
    return depName === match
  }
  else if (match instanceof RegExp) {
    return match.test(depName)
  }
  return false
}

export function inferCatalogName(dep: Omit<RawDep, 'catalogName'>, options: CatalogOptions): string {
  for (const rule of options.catalogRules ?? []) {
    const { name, match, specifierRules } = rule

    if (!isDepMatched(dep.name, match))
      continue

    if (!specifierRules?.length)
      return name

    const version = cleanSpec(dep.specifier, options)
    if (!version)
      return name

    const matchingRules = specifierRules.filter((specifierRule) => {
      if (specifierRule.match && !isDepMatched(dep.name, specifierRule.match))
        return false
      return satisfies(version, specifierRule.specifier)
    })

    if (matchingRules.length === 0)
      return name

    if (matchingRules.length === 1) {
      const rule = matchingRules[0]
      return rule.name || `${name}-${rule.suffix}`
    }

    const bestMatching = mostSpecificRule(matchingRules)
    return bestMatching.name || `${name}-${bestMatching.suffix}`
  }

  return DEP_TYPE_GROUP_NAME_MAP[dep.source] || 'default'
}
