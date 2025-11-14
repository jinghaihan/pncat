import type { CatalogOptions, DepType, RawDep } from '../types'
import { extractCatalogName, inferCatalogName, isCatalogSpecifier, isCatalogWorkspace } from '../utils/catalog'
import { isPnpmOverridesPackageName } from '../utils/helper'

interface FlattenPkgData { [key: string]: { specifier: string, parents: string[] } }

function flatten(obj: any, parents: string[] = []): FlattenPkgData {
  if (!obj)
    return obj

  let flattenData: FlattenPkgData = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object')
      flattenData = { ...flattenData, ...flatten(value, [...parents, key]) }
    else if (typeof value === 'string')
      flattenData[key] = { specifier: value, parents }
  }
  return flattenData
}

export function getByPath(obj: any, path: string) {
  return flatten(path.split('.').reduce((o, i) => o?.[i], obj))
}

export function parseDependency(
  name: string,
  specifier: string,
  type: DepType,
  shouldCatalog: (name: string, specifier: string) => boolean,
  options: CatalogOptions,
  parents?: string[],
  packageName?: string,
): RawDep {
  const dep: Omit<RawDep, 'catalogName'> = {
    name,
    specifier,
    parents,
    source: type,
    catalog: isCatalogWorkspace(type) || isCatalogSpecifier(specifier),
    catalogable: shouldCatalog(name, specifier),
  }

  return {
    ...dep,
    catalogName: isCatalogWorkspace(type) && !isPnpmOverridesPackageName(packageName)
      ? extractCatalogName(packageName!)
      : inferCatalogName(dep, options),
  }
}

export function parseDependencies(
  pkg: any,
  type: DepType,
  shouldCatalog: (name: string, specifier: string) => boolean,
  options: CatalogOptions,
): RawDep[] {
  return Object.entries(getByPath(pkg, type) || {})
    .map(([name, { specifier, parents }]) => parseDependency(
      name,
      specifier,
      type,
      shouldCatalog,
      options,
      parents,
    ))
}
