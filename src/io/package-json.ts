import type { CatalogOptions, DepFilter, PackageJson, PackageJsonMeta, RawDep } from '@/types'
import { resolve } from 'pathe'
import { DEPS_FIELDS } from '@/constants'
import { getCwd, isDepFieldEnabled, parseDependencies } from '@/utils'
import { readJsonFile } from './json'

export async function loadPackageJSON(
  relative: string,
  options: CatalogOptions,
  shouldCatalog: DepFilter,
): Promise<PackageJsonMeta[]> {
  const filepath = resolve(getCwd(options), relative)
  const raw = await readJsonFile<PackageJson>(filepath)
  const deps = parsePackageDependencies(raw, options, shouldCatalog)

  return [
    {
      name: typeof raw.name === 'string' ? raw.name : relative,
      private: !!raw.private,
      version: typeof raw.version === 'string' ? raw.version : undefined,
      type: 'package.json',
      relative,
      filepath,
      raw,
      deps,
    },
  ]
}

function parsePackageDependencies(
  raw: PackageJson,
  options: CatalogOptions,
  shouldCatalog: DepFilter,
): RawDep[] {
  const deps: RawDep[] = []
  for (const key of DEPS_FIELDS) {
    if (!isDepFieldEnabled(options, key))
      continue
    deps.push(...parseDependencies(raw, key, shouldCatalog, options))
  }

  return deps
}
