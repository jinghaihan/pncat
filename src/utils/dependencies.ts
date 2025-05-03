import type { DepType, RawDep } from '../types'

interface FlattenPkgData { [key: string]: { version: string, parents: string[] } }

function flatten(obj: any, parents: string[] = []): FlattenPkgData {
  if (!obj)
    return obj

  let flattenData: FlattenPkgData = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object')
      flattenData = { ...flattenData, ...flatten(value, [...parents, key]) }
    else if (typeof value === 'string')
      flattenData[key] = { version: value, parents }
  }
  return flattenData
}

export function getByPath(obj: any, path: string) {
  return flatten(path.split('.').reduce((o, i) => o?.[i], obj))
}

export function parseDependency(
  name: string,
  version: string,
  type: DepType,
  shouldCatalog: (name: string) => boolean,
  parents?: string[],
): RawDep {
  return {
    name,
    specifier: version,
    parents,
    source: type,
    // when `catalog` marked to `false`, it will be bypassed on resolving
    catalog: shouldCatalog(name),
  }
}

export function parseDependencies(
  pkg: any,
  type: DepType,
  shouldCatalog: (name: string) => boolean,
): RawDep[] {
  return Object.entries(getByPath(pkg, type) || {}).map(([name, { version, parents }]) => parseDependency(name, version, type, shouldCatalog, parents))
}
