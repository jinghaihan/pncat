import type { CatalogOptions, DepType } from '../types'
import process from 'node:process'
import { resolve } from 'pathe'
import { PACKAGE_MANAGERS } from '../constants'

export function getCwd(options?: CatalogOptions): string {
  return resolve(options?.cwd || process.cwd())
}

export function isDepFieldEnabled(options: CatalogOptions, depType: DepType): boolean {
  return !!options.depFields?.[depType]
}

export function isCatalogSpecifier(specifier: string): boolean {
  return specifier.startsWith('catalog:')
}

export function isCatalogWorkspace(type: DepType): boolean {
  for (const agent of PACKAGE_MANAGERS) {
    if (type === `${agent}-workspace`)
      return true
  }
  return false
}

export function isCatalogPackageName(name: string): boolean {
  if (!name)
    return false
  for (const agent of PACKAGE_MANAGERS) {
    if (name.startsWith(`${agent}-catalog:`))
      return true
  }
  return false
}

export function extractCatalogName(name: string): string {
  let content = name
  for (const agent of PACKAGE_MANAGERS) {
    content = content.replace(`${agent}-catalog:`, '')
  }
  return content
}

export function isPnpmOverridesPackageName(pkgName?: string): boolean {
  return pkgName === 'pnpm-workspace:overrides'
}
