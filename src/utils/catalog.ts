import type { CatalogOptions, DepType, RawDep, WorkspaceSchema } from '../types'
import { satisfies } from 'semver'
import { DEPS_TYPE_CATALOG_MAP } from '../constants'
import { cleanSpec, mostSpecificRule } from './specifier'

export function isCatalogWorkspace(type: DepType) {
  return type === 'pnpm-workspace'
    || type === 'yarn-workspace'
    || type === 'bun-workspace'
    || type === 'vlt-workspace'
}

export function extractCatalogName(name: string) {
  return name
    .replace('pnpm-catalog:', '')
    .replace('yarn-catalog:', '')
    .replace('bun-catalog:', '')
    .replace('vlt-catalog:', '')
}

export function normalizeCatalogName(catalogName: string) {
  return catalogName === 'default' ? 'catalog:' : `catalog:${catalogName}`
}

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

  return DEPS_TYPE_CATALOG_MAP[dep.source] || 'default'
}

export function createDepCatalogIndex(workspaceJson?: WorkspaceSchema) {
  const catalogIndex = new Map<string, { catalogName: string, specifier: string }[]>()
  if (!workspaceJson)
    return catalogIndex

  if (workspaceJson.catalog) {
    for (const [depName, specifier] of Object.entries(workspaceJson.catalog)) {
      if (!catalogIndex.has(depName))
        catalogIndex.set(depName, [])

      catalogIndex.get(depName)?.push({
        catalogName: 'default',
        specifier,
      })
    }
  }
  if (workspaceJson.catalogs) {
    for (const [catalogName, catalog] of Object.entries(workspaceJson.catalogs)) {
      if (catalog) {
        for (const [depName, specifier] of Object.entries(catalog)) {
          if (!catalogIndex.has(depName))
            catalogIndex.set(depName, [])

          catalogIndex.get(depName)?.push({
            catalogName,
            specifier,
          })
        }
      }
    }
  }

  return catalogIndex
}
