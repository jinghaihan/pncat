import type { CatalogOptions, DepFilter, PackageMeta } from '../types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { findUp } from 'find-up-simple'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFAULT_IGNORE_PATHS } from '../constants'
import { createDependenciesFilter } from '../utils/filter'
import { readJSON } from './fs'
import { loadPackageJSON } from './package-json'

export async function findPackageJsonPaths(options: CatalogOptions): Promise<string[]> {
  const { agent = 'pnpm' } = options

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

        // pnpm workspace
        if (agent === 'pnpm') {
          const pnpmWorkspace = await findUp('pnpm-workspace.yaml', { cwd: absolute, stopAt: cwd })
          if (pnpmWorkspace && dirname(pnpmWorkspace) !== cwd)
            return []
        }

        // yarn workspace
        if (agent === 'yarn') {
          const yarnWorkspace = await findUp('.yarnrc.yml', { cwd: absolute, stopAt: cwd })
          if (yarnWorkspace && dirname(yarnWorkspace) !== cwd)
            return []
        }

        // vlt workspace
        if (agent === 'vlt') {
          const vltWorkspace = await findUp('vlt.json', { cwd: absolute, stopAt: cwd })
          if (vltWorkspace && dirname(vltWorkspace) !== cwd)
            return []
        }

        return [packagePath]
      }),
    )).flat()
  }

  return packagePaths
}

export async function loadPackage(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<PackageMeta[]> {
  const { PnpmCatalog, YarnCatalog, VltCatalog, BunCatalog } = await import('../catalog-handler')

  if (relative.endsWith('pnpm-workspace.yaml'))
    return PnpmCatalog.loadWorkspace(relative, options, shouldCatalog)

  if (relative.endsWith('.yarnrc.yml'))
    return YarnCatalog.loadWorkspace(relative, options, shouldCatalog)

  if (relative.endsWith('vlt.json'))
    return VltCatalog.loadWorkspace(relative, options, shouldCatalog)

  // Check if this package.json contains Bun workspaces with catalogs
  if (relative.endsWith('package.json')) {
    const filepath = resolve(options.cwd ?? '', relative)
    try {
      const packageJsonRaw = await readJSON(filepath)
      const workspaces = packageJsonRaw?.workspaces

      // Only process Bun catalogs if we detect Bun is being used
      if (workspaces && (workspaces.catalog || workspaces.catalogs)) {
        const cwd = resolve(options.cwd || process.cwd())
        const hasBunLock = existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))

        if (hasBunLock) {
          const bunWorkspaces = await BunCatalog.loadWorkspace(relative, options, shouldCatalog)
          const packageJson = await loadPackageJSON(relative, options, shouldCatalog)
          return [...bunWorkspaces, ...packageJson]
        }
      }
    }
    catch {
      // Safe guard: If we can't read the file, fall back to normal package.json loading
    }
  }

  return loadPackageJSON(relative, options, shouldCatalog)
}

export async function loadPackages(options: CatalogOptions): Promise<PackageMeta[]> {
  const { agent = 'pnpm' } = options

  const cwd = resolve(options.cwd || process.cwd())
  const filter = createDependenciesFilter(
    options.include,
    options.exclude,
    options.allowedProtocols,
    options.specifierOptions,
  )
  const packagePaths: string[] = await findPackageJsonPaths(options)

  // pnpm workspace
  if (agent === 'pnpm' && existsSync(join(cwd, 'pnpm-workspace.yaml')))
    packagePaths.unshift('pnpm-workspace.yaml')

  // yarn workspace
  if (agent === 'yarn' && existsSync(join(cwd, '.yarnrc.yml')))
    packagePaths.unshift('.yarnrc.yml')

  // vlt workspace
  if (agent === 'vlt' && existsSync(join(cwd, 'vlt.json')))
    packagePaths.unshift('vlt.json')

  const packages = (await Promise.all(
    packagePaths.map(relative => loadPackage(relative, options, filter)),
  )).flat()

  return packages
}
