import type { CatalogOptions, DepFilter, PackageMeta } from '../types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { findUp } from 'find-up'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFAULT_IGNORE_PATHS } from '../constants'
import { createDependenciesFilter } from '../utils/filter'
import { loadPackageJSON } from './package-json'
import { loadPnpmWorkspace } from './pnpm-workspace'

export async function findPackageJsonPaths(options: CatalogOptions): Promise<string[]> {
  let packagePaths: string[] = []
  const cwd = resolve(options.cwd || process.cwd())

  if (options.recursive) {
    packagePaths = await glob('**/package.json', {
      ignore: DEFAULT_IGNORE_PATHS.concat(options.ignorePaths || []),
      cwd: options.cwd,
      onlyFiles: true,
      dot: false,
      expandDirectories: false,
    })
    packagePaths.sort((a, b) => a.localeCompare(b))
  }
  else {
    packagePaths = ['package.json']
  }

  if (options.ignoreOtherWorkspaces) {
    packagePaths = (await Promise.all(
      packagePaths.map(async (packagePath) => {
        if (!packagePath.includes('/'))
          return [packagePath]

        const absolute = join(cwd, packagePath)
        const gitDir = await findUp('.git', { cwd: absolute, stopAt: cwd })
        if (gitDir && dirname(gitDir) !== cwd)
          return []
        const pnpmWorkspace = await findUp('pnpm-workspace.yaml', { cwd: absolute, stopAt: cwd })
        if (pnpmWorkspace && dirname(pnpmWorkspace) !== cwd)
          return []
        return [packagePath]
      }),
    )).flat()
  }

  return packagePaths
}

export async function loadPackage(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<PackageMeta[]> {
  if (relative.endsWith('pnpm-workspace.yaml'))
    return loadPnpmWorkspace(relative, options, shouldCatalog)
  return loadPackageJSON(relative, options, shouldCatalog)
}

export async function loadPackages(options: CatalogOptions): Promise<PackageMeta[]> {
  const cwd = resolve(options.cwd || process.cwd())
  const filter = createDependenciesFilter(
    options.include,
    options.exclude,
    options.allowedProtocols,
    options.specifierOptions,
  )
  const packagePaths: string[] = await findPackageJsonPaths(options)
  if (existsSync(join(cwd, 'pnpm-workspace.yaml')))
    packagePaths.unshift('pnpm-workspace.yaml')

  const packages = (await Promise.all(
    packagePaths.map(relative => loadPackage(relative, options, filter)),
  )).flat()

  return packages
}
