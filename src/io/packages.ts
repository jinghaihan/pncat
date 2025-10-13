import type { CatalogOptions, DepFilter, PackageJson, PackageMeta } from '../types'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import detectIndent from 'detect-indent'
import { findUp } from 'find-up-simple'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFAULT_IGNORE_PATHS } from '../constants'
import { createDependenciesFilter } from '../utils/filter'
import { loadPackageJSON } from './package-json'
import { loadPnpmWorkspace } from './pnpm-workspace'
import { loadYarnWorkspace } from './yarn-workspace'

export async function readJSON(filepath: string) {
  return JSON.parse(await readFile(filepath, 'utf-8'))
}

export async function writeJSON(filepath: string, data: PackageJson) {
  const content = await readFile(filepath, 'utf-8')
  const fileIndent = detectIndent(content).indent || '  '

  return await writeFile(filepath, `${JSON.stringify(data, null, fileIndent)}\n`, 'utf-8')
}

export async function findPackageJsonPaths(options: CatalogOptions): Promise<string[]> {
  const { packageManager = 'pnpm' } = options

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

        if (packageManager === 'pnpm') {
          // pnpm workspace
          const pnpmWorkspace = await findUp('pnpm-workspace.yaml', { cwd: absolute, stopAt: cwd })
          if (pnpmWorkspace && dirname(pnpmWorkspace) !== cwd)
            return []
        }

        if (packageManager === 'yarn') {
          // yarn workspace
          const yarnWorkspace = await findUp('.yarnrc.yml', { cwd: absolute, stopAt: cwd })
          if (yarnWorkspace && dirname(yarnWorkspace) !== cwd)
            return []
        }

        return [packagePath]
      }),
    )).flat()
  }

  return packagePaths
}

export async function loadPackage(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<PackageMeta[]> {
  if (relative.endsWith('pnpm-workspace.yaml'))
    return loadPnpmWorkspace(relative, options, shouldCatalog)
  if (relative.endsWith('.yarnrc.yml'))
    return loadYarnWorkspace(relative, options, shouldCatalog)
  return loadPackageJSON(relative, options, shouldCatalog)
}

export async function loadPackages(options: CatalogOptions): Promise<PackageMeta[]> {
  const { packageManager = 'pnpm' } = options

  const cwd = resolve(options.cwd || process.cwd())
  const filter = createDependenciesFilter(
    options.include,
    options.exclude,
    options.allowedProtocols,
    options.specifierOptions,
  )
  const packagePaths: string[] = await findPackageJsonPaths(options)

  // pnpm workspace
  if (packageManager === 'pnpm' && existsSync(join(cwd, 'pnpm-workspace.yaml')))
    packagePaths.unshift('pnpm-workspace.yaml')

  // yarn workspace
  if (packageManager === 'yarn' && existsSync(join(cwd, '.yarnrc.yml')))
    packagePaths.unshift('.yarnrc.yml')

  const packages = (await Promise.all(
    packagePaths.map(relative => loadPackage(relative, options, filter)),
  )).flat()

  return packages
}
