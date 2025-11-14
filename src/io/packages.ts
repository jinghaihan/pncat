import type { CatalogOptions, DepFilter, PackageMeta } from '../types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import { findUp } from 'find-up-simple'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { AGENT_CONFIG, DEFAULT_IGNORE_PATHS } from '../constants'
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

        const filename = AGENT_CONFIG[agent].filename
        const filepath = await findUp(filename, { cwd: absolute, stopAt: cwd })
        if (filepath && dirname(filepath) !== cwd)
          return []

        return [packagePath]
      }),
    )).flat()
  }

  return packagePaths
}

export async function loadPackage(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<PackageMeta[]> {
  const { PnpmCatalog, YarnCatalog, VltCatalog, BunCatalog } = await import('../catalog-handler')

  if (relative.endsWith(AGENT_CONFIG.pnpm.filename))
    return PnpmCatalog.loadWorkspace(relative, options, shouldCatalog)

  if (relative.endsWith(AGENT_CONFIG.yarn.filename))
    return YarnCatalog.loadWorkspace(relative, options, shouldCatalog)

  if (relative.endsWith(AGENT_CONFIG.vlt.filename))
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
        if (toArray(AGENT_CONFIG.bun.locks).some(lock => existsSync(join(cwd, lock)))) {
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

  const filename = AGENT_CONFIG[agent].filename
  if (existsSync(join(cwd, filename)))
    packagePaths.unshift(filename)

  const packages = (await Promise.all(
    packagePaths.map(relative => loadPackage(relative, options, filter)),
  )).flat()

  return packages
}
