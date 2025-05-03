import type { CatalogOptions, PackageMeta } from '../types'
import { loadPackages } from '../utils/packages'

export interface ScannerCallbacks {
  afterPackagesLoaded?: (pkgs: PackageMeta[]) => void
  beforePackageStart?: (pkg: PackageMeta) => void
  onPackageResolved?: (pkg: PackageMeta) => void | Promise<void>
  afterPackageEnd?: (pkg: PackageMeta) => void
  afterPackagesEnd?: (pkgs: PackageMeta[]) => void
  afterPackageWrite?: (pkg: PackageMeta) => void
}

export async function Scanner(
  options: CatalogOptions,
  callbacks: ScannerCallbacks = {},
) {
  // packages loading
  const packages = await loadPackages(options)
  callbacks.afterPackagesLoaded?.(packages)

  for (const pkg of packages) {
    callbacks.beforePackageStart?.(pkg)

    await callbacks.onPackageResolved?.(pkg)

    callbacks.afterPackageEnd?.(pkg)
  }

  callbacks.afterPackagesEnd?.(packages)

  return {
    packages,
  }
}
