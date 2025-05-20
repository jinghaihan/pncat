import type { CommonOptions, PackageMeta } from '../types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { findUp } from 'find-up'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFAULT_IGNORE_PATHS } from '../constants'
import { createDependenciesFilter } from './filter'
import { loadPackageJSON } from './package-json'
import { loadPnpmWorkspace } from './pnpm-workspace'

export async function loadPackage(
  relative: string,
  options: CommonOptions,
  shouldCatalog: (name: string, specifier: string) => boolean,
): Promise<PackageMeta[]> {
  if (relative.endsWith('pnpm-workspace.yaml'))
    return loadPnpmWorkspace(relative, options, shouldCatalog)
  return loadPackageJSON(relative, options, shouldCatalog)
}

export async function loadPackages(options: CommonOptions): Promise<PackageMeta[]> {
  let packagesNames: string[] = []
  const cwd = resolve(options.cwd || process.cwd())
  const filter = createDependenciesFilter(options.include, options.exclude, options.specifierOptions)

  if (options.recursive) {
    packagesNames = await glob('**/package.json', {
      ignore: DEFAULT_IGNORE_PATHS.concat(options.ignorePaths || []),
      cwd: options.cwd,
      onlyFiles: true,
      dot: false,
      expandDirectories: false,
    })
    packagesNames.sort((a, b) => a.localeCompare(b))
  }
  else {
    packagesNames = ['package.json']
  }

  if (options.ignoreOtherWorkspaces) {
    packagesNames = (await Promise.all(
      packagesNames.map(async (packagePath) => {
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

  if (existsSync(join(cwd, 'pnpm-workspace.yaml'))) {
    packagesNames.unshift('pnpm-workspace.yaml')
  }

  const packages = (await Promise.all(
    packagesNames.map(
      relative => loadPackage(relative, options, filter),
    ),
  )).flat()

  return packages
}
