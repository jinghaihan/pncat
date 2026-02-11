import type { CatalogOptions, DependencyEntry, DepFilter, DepType, RawDep } from '@/types'
import {
  extractCatalogName,
  inferCatalogName,
  isCatalogSpecifier,
  isCatalogWorkspace,
} from './catalog'
import { getValueByPath, isObject, isPnpmOverridesPackageName } from './helper'

export function parseDependencies(
  pkg: Record<string, unknown>,
  type: DepType,
  shouldCatalog: DepFilter,
  options: CatalogOptions,
): RawDep[] {
  return getDependencyEntries(pkg, type).map(entry => parseDependency(
    entry.name,
    entry.specifier,
    type,
    shouldCatalog,
    options,
    entry.parents,
  ))
}

export function parseDependency(
  name: string,
  specifier: string,
  type: DepType,
  shouldCatalog: DepFilter,
  options: CatalogOptions,
  parents: string[] = [],
  packageName?: string,
): RawDep {
  const dep: Omit<RawDep, 'catalogName'> = {
    name,
    specifier,
    parents,
    source: type,
    catalogable: shouldCatalog(name, specifier),
    isCatalog: isCatalogWorkspace(type) || isCatalogSpecifier(specifier),
  }

  return {
    ...dep,
    catalogName: getCatalogName(dep, type, packageName, options),
  }
}

function getCatalogName(
  dep: Omit<RawDep, 'catalogName'>,
  source: DepType,
  packageName: string | undefined,
  options: CatalogOptions,
): string {
  if (packageName && isCatalogWorkspace(source) && !isPnpmOverridesPackageName(packageName))
    return extractCatalogName(packageName)
  return inferCatalogName(dep, options)
}

function getDependencyEntries(pkg: Record<string, unknown>, type: DepType): DependencyEntry[] {
  return flattenDependencies(getValueByPath(pkg, type))
}

function flattenDependencies(input: unknown, parents: string[] = [], output: DependencyEntry[] = []): DependencyEntry[] {
  if (!isObject(input))
    return output

  for (const [name, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      output.push({ name, specifier: value, parents })
      continue
    }

    if (isObject(value))
      flattenDependencies(value, [...parents, name], output)
  }

  return output
}
