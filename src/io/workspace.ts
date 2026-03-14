import type { CatalogOptions, PackageManager } from '@/types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { findUp } from 'find-up'
import { dirname, join, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFAULT_IGNORE_PATHS, PACKAGE_MANAGER_CONFIG } from '@/constants'
import { getCwd } from '@/utils'
import { findWorkspacePatterns } from './workspace-patterns'

const TRAILING_SLASH_RE = /\/+$/

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
  const { hasWorkspaceConfig, patterns } = await findWorkspacePatterns(options)

  let packagePaths = !options.recursive
    ? ['package.json']
    : hasWorkspaceConfig
      ? await globPackageJsonPaths(patternsToPackageJsonGlobs(patterns), options)
      : await globPackageJsonPaths(['**/package.json'], options)
  if (options.ignoreOtherWorkspaces)
    packagePaths = await filterOtherWorkspacePaths(packagePaths, options)

  return buildWorkspacePaths(agent, options, packagePaths)
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

async function globPackageJsonPaths(patterns: string[], options: CatalogOptions): Promise<string[]> {
  if (patterns.length === 0)
    return []

  const packagePaths = await glob(patterns, {
    ignore: DEFAULT_IGNORE_PATHS.concat(options.ignorePaths || []),
    cwd: getCwd(options),
    onlyFiles: true,
    dot: false,
    expandDirectories: false,
  })
  packagePaths.sort((a, b) => a.localeCompare(b))
  return packagePaths
}

function buildWorkspacePaths(
  agent: PackageManager,
  options: CatalogOptions,
  packagePaths: string[],
): string[] {
  const cwd = getCwd(options)
  const workspacePaths = existsSync(join(cwd, PACKAGE_MANAGER_CONFIG[agent].filename))
    ? [PACKAGE_MANAGER_CONFIG[agent].filename]
    : []
  const rootPackagePath = existsSync(join(cwd, 'package.json'))
    ? ['package.json']
    : []

  return Array.from(new Set([...workspacePaths, ...rootPackagePath, ...packagePaths]))
}

function patternsToPackageJsonGlobs(patterns: string[]): string[] {
  return patterns.map((pattern) => {
    const isNegativePattern = pattern.startsWith('!')
    const rawPattern = isNegativePattern ? pattern.slice(1) : pattern
    const normalizedPattern = rawPattern.replace(TRAILING_SLASH_RE, '') || '.'
    const packageJsonPattern = normalizedPattern === '.'
      ? 'package.json'
      : normalizedPattern.endsWith('/package.json') || normalizedPattern === 'package.json'
        ? normalizedPattern
        : `${normalizedPattern}/package.json`

    return isNegativePattern ? `!${packageJsonPattern}` : packageJsonPattern
  })
}
