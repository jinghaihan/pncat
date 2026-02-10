import type { CatalogOptions, RawDep, WorkspaceSchema } from '../types'
import { satisfies } from 'semver'
import { DEPS_TYPE_CATALOG_MAP } from '../constants'
import { cleanSpec, mostSpecificRule } from './specifier'

export function createDepCatalogIndex(workspaceJson?: WorkspaceSchema) {
  const catalogIndex = new Map<string, { catalogName: string, specifier: string }[]>()
  if (!workspaceJson)
    return catalogIndex

  if (workspaceJson.catalog) {
    for (const [depName, specifier] of Object.entries(workspaceJson.catalog)) {
      catalogIndex.set(depName, [
        ...(catalogIndex.get(depName) || []),
        { catalogName: 'default', specifier },
      ])
    }
  }

  if (workspaceJson.catalogs) {
    for (const [catalogName, catalog] of Object.entries(workspaceJson.catalogs)) {
      if (!catalog)
        continue

      for (const [depName, specifier] of Object.entries(catalog)) {
        catalogIndex.set(depName, [
          ...(catalogIndex.get(depName) || []),
          { catalogName, specifier },
        ])
      }
    }
  }

  return catalogIndex
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
      const single = matchingRules[0]
      return single.name || `${name}-${single.suffix}`
    }

    const best = mostSpecificRule(matchingRules)
    return best.name || `${name}-${best.suffix}`
  }

  return DEPS_TYPE_CATALOG_MAP[dep.source] || 'default'
}

function isDepMatched(depName: string, match: string | RegExp | (string | RegExp)[]): boolean {
  if (Array.isArray(match))
    return match.some(item => typeof item === 'string' ? depName === item : item.test(depName))

  if (typeof match === 'string')
    return depName === match

  if (match instanceof RegExp)
    return match.test(depName)

  return false
}
