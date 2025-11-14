import type { DepType, RawDep } from '../src/types'
import { isCatalogSpecifier } from '../src/utils/catalog'

export function createDep<T = Omit<RawDep, 'catalogName'>>(
  name: string,
  specifier: string = 'v1.0.0',
  source: DepType = 'dependencies',
): T {
  return {
    name,
    specifier,
    source,
    catalog: isCatalogSpecifier(specifier),
    catalogable: true,
  } as T
}
