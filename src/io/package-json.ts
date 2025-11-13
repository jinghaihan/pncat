import type { CatalogOptions, DepType, PackageJsonMeta, RawDep } from '../types'
import { resolve } from 'pathe'
import { DEPS_FIELDS } from '../constants'
import { parseDependencies } from './dependencies'
import { readJSON } from './fs'

function isDepFieldEnabled(key: DepType, options: CatalogOptions): boolean {
  if (!options.depFields?.[key])
    return false
  return true
}

export async function loadPackageJSON(
  relative: string,
  options: CatalogOptions,
  shouldCatalog: (name: string, specifier: string) => boolean,
): Promise<PackageJsonMeta[]> {
  const filepath = resolve(options.cwd ?? '', relative)
  const raw = await readJSON(filepath)
  const deps: RawDep[] = []

  for (const key of DEPS_FIELDS) {
    if (!isDepFieldEnabled(key, options))
      continue

    deps.push(...parseDependencies(raw, key, shouldCatalog, options))
  }

  return [
    {
      name: raw.name!,
      private: !!raw.private,
      version: raw.version,
      type: 'package.json',
      relative,
      filepath,
      raw,
      deps,
    },
  ]
}
