import type { DepType, PackageJson, PackageJsonDepSource, PnpmConfig } from '@/types'
import { DEPS_FIELDS } from '@/constants'
import { isCatalogWorkspace } from './catalog'
import { isObject } from './helper'

export function isPackageJsonDepSource(source: DepType): source is PackageJsonDepSource {
  return source !== 'pnpm.overrides' && !isCatalogWorkspace(source)
}

export function getPackageJsonDeps(
  pkgJson: PackageJson,
  source: PackageJsonDepSource,
): Record<string, string> | undefined {
  const deps = pkgJson[source]
  if (!isObject(deps))
    return undefined

  return deps as Record<string, string>
}

export function ensurePackageJsonDeps(
  pkgJson: PackageJson,
  source: PackageJsonDepSource,
): Record<string, string> {
  const deps = getPackageJsonDeps(pkgJson, source)
  if (deps)
    return deps

  const created: Record<string, string> = {}
  pkgJson[source] = created
  return created
}

export function getPnpmOverrides(pkgJson: PackageJson): Record<string, string> | undefined {
  if (!isObject(pkgJson.pnpm))
    return undefined
  if (!isObject(pkgJson.pnpm.overrides))
    return undefined

  return pkgJson.pnpm.overrides as Record<string, string>
}

export function ensurePnpmOverrides(pkgJson: PackageJson): Record<string, string> {
  if (!isObject(pkgJson.pnpm))
    pkgJson.pnpm = {}

  const pnpm = pkgJson.pnpm as PnpmConfig
  if (!isObject(pnpm.overrides))
    pnpm.overrides = {}

  return pnpm.overrides as Record<string, string>
}

export function cleanupPackageJSON(pkgJson: PackageJson): PackageJson {
  for (const field of DEPS_FIELDS) {
    if (!isPackageJsonDepSource(field))
      continue

    const deps = getPackageJsonDeps(pkgJson, field)
    if (!deps)
      continue
    if (Object.keys(deps).length === 0)
      delete pkgJson[field]
  }

  return pkgJson
}
