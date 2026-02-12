import type { CatalogOptions, DepType, PackageJsonDepSource, PackageMeta } from '@/types'
import process from 'node:process'
import { resolve } from 'pathe'

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function cloneDeep<T>(data: T): T {
  return structuredClone(data)
}

export function getValueByPath(input: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isObject(current))
      return undefined
    return current[key]
  }, input)
}

export function getCwd(options?: CatalogOptions): string {
  return resolve(options?.cwd || process.cwd())
}

export function getDepSource(
  isDev: boolean = false,
  isOptional: boolean = false,
  isPeer: boolean = false,
): PackageJsonDepSource {
  return isDev
    ? 'devDependencies'
    : isOptional
      ? 'optionalDependencies'
      : isPeer ? 'peerDependencies' : 'dependencies'
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
