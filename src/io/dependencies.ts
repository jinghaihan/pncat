import type { CatalogOptions, DepType, RawDep } from '../types'
import { inferCatalogName } from '../utils/catalog'

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
  catalogPkgName?: string,
): RawDep {
  const dep: Omit<RawDep, 'catalogName'> = {
    name,
    specifier,
    parents,
    source: type,
    catalog: type === 'pnpm-workspace' || specifier.startsWith('catalog:'),
    catalogable: shouldCatalog(name, specifier),
  }

  return {
    ...dep,
    catalogName: type === 'pnpm-workspace' ? catalogPkgName!.replace('pnpm-catalog:', '') : inferCatalogName(dep, options),
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
