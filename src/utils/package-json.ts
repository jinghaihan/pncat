import type { PackageJson } from '../types'
import { DEPS_FIELDS } from '../constants'

export function cleanupPackageJSON(pkgJson: PackageJson): PackageJson {
  for (const field of DEPS_FIELDS) {
    const deps = pkgJson[field]
    if (!deps)
      continue
    if (Object.keys(deps).length === 0)
      delete pkgJson[field]
  }

  return pkgJson
}
