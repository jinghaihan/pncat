import type { CatalogOptions, PackageManager } from '../types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { findUp } from 'find-up'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFAULT_IGNORE_PATHS, PACKAGE_MANAGER_CONFIG } from '../constants'
import { getCwd } from '../utils'

export async function detectWorkspaceRoot(
  agent: PackageManager = 'pnpm',
  cwd: string = process.cwd(),
): Promise<string> {
  const root = await findUp(['.git', ...PACKAGE_MANAGER_CONFIG[agent].locks], { cwd })
  if (root)
    return dirname(root)
  return resolve(cwd)
}

export async function findPackageJsonPaths(options: CatalogOptions): Promise<string[]> {
  const { agent = 'pnpm' } = options

  let packagePaths = await collectPackageJsonPaths(options)
  if (options.ignoreOtherWorkspaces)
    packagePaths = await filterOtherWorkspacePaths(packagePaths, options)

  const filename = PACKAGE_MANAGER_CONFIG[agent].filename
  const paths = existsSync(join(getCwd(options), filename))
    ? [filename, ...packagePaths]
    : packagePaths

  return Array.from(new Set(paths))
}

async function collectPackageJsonPaths(options: CatalogOptions): Promise<string[]> {
  if (!options.recursive)
    return ['package.json']

  const packagePaths = await glob(`**/package.json`, {
    ignore: DEFAULT_IGNORE_PATHS.concat(options.ignorePaths || []),
    cwd: options.cwd,
    onlyFiles: true,
    dot: false,
    expandDirectories: false,
  })
  packagePaths.sort((a, b) => a.localeCompare(b))
  return packagePaths
}

async function filterOtherWorkspacePaths(packagePaths: string[], options: CatalogOptions): Promise<string[]> {
  const { agent = 'pnpm' } = options
  const cwd = getCwd(options)
  const filename = PACKAGE_MANAGER_CONFIG[agent].filename

  const decisions = await Promise.all(packagePaths.map(async (packagePath) => {
    const outOfWorkspace = await isOutOfCurrentWorkspace(packagePath, cwd, filename)
    return outOfWorkspace ? undefined : packagePath
  }))

  return decisions.filter((item): item is string => !!item)
}

async function isOutOfCurrentWorkspace(
  packagePath: string,
  cwd: string,
  workspaceFilename: string,
): Promise<boolean> {
  if (!packagePath.includes('/'))
    return false

  const absolute = join(cwd, packagePath)
  const gitDir = await findUp('.git', { cwd: absolute, stopAt: cwd })
  if (gitDir && dirname(gitDir) !== cwd)
    return true

  // For bun, workspace filename is package.json and every package has it,
  // so using findUp(package.json) would incorrectly filter local sub-packages.
  if (workspaceFilename === 'package.json')
    return false

  const workspaceFile = await findUp(workspaceFilename, { cwd: absolute, stopAt: cwd })
  return !!(workspaceFile && dirname(workspaceFile) !== cwd)
}
