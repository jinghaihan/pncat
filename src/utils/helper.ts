import type { CatalogOptions, DepType, PackageMeta } from '../types'
import process from 'node:process'
import { resolve } from 'pathe'

export function getCwd(options?: CatalogOptions): string {
  return resolve(options?.cwd || process.cwd())
}

export function isDepFieldEnabled(options: CatalogOptions, depType: DepType): boolean {
  return !!options.depFields?.[depType]
}

export function isPnpmOverridesPackageName(pkgName?: string): boolean {
  return pkgName === 'pnpm-workspace:overrides'
}

export function hasEslint(packages: PackageMeta[]): boolean {
  for (const pkg of packages) {
    if (pkg.type !== 'package.json')
      continue

    if (pkg.deps.some(dep => dep.name === 'eslint'))
      return true
  }

  return false
}

export function hasVSCodeEngine(packages: PackageMeta[]): boolean {
  for (const pkg of packages) {
    if (pkg.type !== 'package.json')
      continue

    if (pkg.raw.engines?.vscode)
      return true
  }

  return false
}
