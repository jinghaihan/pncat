import type { DepType, RawDep } from '../src/types'

export function createDep<T = Omit<RawDep, 'catalogName'>>(
  name: string,
  specifier: string = 'v1.0.0',
  source: DepType = 'dependencies',
): T {
  return {
    name,
    specifier,
    source,
    catalog: specifier.startsWith('catalog:'),
    catalogable: true,
  } as T
}
