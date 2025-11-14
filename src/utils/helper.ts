import type { PackageJsonMeta, PackageMeta, RawDep } from '../types'
import type { Workspace } from '../workspace-manager'
import { normalizeCatalogName } from './catalog'

export function getDepSource(isDev: boolean = false, isOptional: boolean = false, isPeer: boolean = false) {
  return isDev
    ? 'devDependencies'
    : isOptional
      ? 'optionalDependencies'
      : isPeer ? 'peerDependencies' : 'dependencies'
}

export function isPnpmOverridesPackageName(pkgName?: string): boolean {
  return pkgName === 'pnpm-workspace:overrides'
}

export async function updatePackageToCatalog(dep: RawDep, data: PackageJsonMeta, workspace: Workspace) {
  if (dep.source === 'pnpm.overrides') {
    data.raw.pnpm.overrides[dep.name] = normalizeCatalogName(dep.catalogName)
    return
  }

  if (dep.source === 'pnpm-workspace') {
    await workspace.catalog.setPackage(normalizeCatalogName(dep.catalogName), dep.name, dep.specifier)
    return
  }

  data.raw[dep.source][dep.name] = normalizeCatalogName(dep.catalogName)
}

export async function updatePackageToSpecifier(dep: RawDep, data: PackageJsonMeta) {
  if (dep.source === 'pnpm.overrides') {
    data.raw.pnpm.overrides[dep.name] = dep.specifier
    return
  }
  data.raw[dep.source][dep.name] = dep.specifier
}

export function containsESLint(packages: PackageMeta[]): boolean {
  for (const pkg of packages) {
    if (pkg.type === 'package.json') {
      if (pkg.deps.find(i => i.name === 'eslint'))
        return true
    }
  }
  return false
}

export function containsVSCodeExtension(packages: PackageMeta[]): boolean {
  for (const pkg of packages) {
    if (pkg.type === 'package.json') {
      const { vscode } = pkg.raw.engines ?? {}
      if (vscode)
        return true
    }
  }
  return false
}
