import type { CommonOptions, PackageJsonMeta, RawDep } from '../types'
import { resolve } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { DEPS_FIELDS } from '../constants'
import { parseDependencies, parseDependency } from './dependencies'

export async function loadPackageJSON(
  relative: string,
  options: CommonOptions,
  shouldCatalog: (name: string) => boolean,
): Promise<PackageJsonMeta[]> {
  const filepath = resolve(options.cwd ?? '', relative)
  const raw = await readPackageJSON(filepath)
  const deps: RawDep[] = []

  for (const key of DEPS_FIELDS) {
    if (options.depFields?.[key] !== false) {
      if (key === 'packageManager') {
        if (raw.packageManager) {
          const [name, version] = raw.packageManager.split('@')
          // `+` sign can be used to pin the hash of the package manager, we remove it to be semver compatible.
          deps.push(parseDependency(name, `^${version.split('+')[0]}`, 'packageManager', shouldCatalog))
        }
      }
      else {
        deps.push(...parseDependencies(raw, key, shouldCatalog))
      }
    }
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
    } satisfies PackageJsonMeta,
  ]
}
