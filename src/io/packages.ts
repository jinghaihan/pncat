import type { CatalogOptions, DepFilter, PackageMeta } from '../types'
import { catalogHandlers } from '../catalog-handler'
import { PACKAGE_MANAGERS } from '../constants'
import { createDependenciesFilter } from '../utils'
import { loadPackageJSON } from './package-json'
import { findPackageJsonPaths } from './workspace'

export async function loadPackages(options: CatalogOptions): Promise<PackageMeta[]> {
  const filter = createDependenciesFilter(
    options.include,
    options.exclude,
    options.allowedProtocols,
    options.specifierOptions,
  )

  const packagePaths = await findPackageJsonPaths(options)
  return (await Promise.all(packagePaths.map(relative => loadPackage(relative, options, filter)))).flat()
}

async function loadPackage(
  relative: string,
  options: CatalogOptions,
  shouldCatalog: DepFilter,
): Promise<PackageMeta[]> {
  const workspacePackage = await loadWorkspacePackage(relative, options, shouldCatalog)
  if (workspacePackage)
    return workspacePackage

  return loadPackageJSON(relative, options, shouldCatalog)
}

async function loadWorkspacePackage(
  relative: string,
  options: CatalogOptions,
  shouldCatalog: DepFilter,
): Promise<PackageMeta[] | null> {
  for (const agent of PACKAGE_MANAGERS) {
    const handler = catalogHandlers[agent]
    const workspacePackage = await handler.loadWorkspace(relative, options, shouldCatalog)
    if (workspacePackage)
      return workspacePackage
  }
  return null
}
