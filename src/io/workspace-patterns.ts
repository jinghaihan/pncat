import type { CatalogOptions, PackageJson } from '@/types'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { getCwd, isObject } from '@/utils'
import { readJsonFile } from './json'

interface PnpmWorkspaceConfig {
  packages?: string | string[]
}

export async function findWorkspacePatterns(
  options: CatalogOptions,
): Promise<{ hasWorkspaceConfig: boolean, patterns: string[] }> {
  const { agent = 'pnpm' } = options

  return agent === 'pnpm'
    ? await readPnpmWorkspacePatterns(options)
    : await readPackageJsonWorkspacePatterns(options)
}

async function readPnpmWorkspacePatterns(
  options: CatalogOptions,
): Promise<{ hasWorkspaceConfig: boolean, patterns: string[] }> {
  const cwd = getCwd(options)
  const filepath = join(cwd, PACKAGE_MANAGER_CONFIG.pnpm.filename)
  if (!existsSync(filepath))
    return { hasWorkspaceConfig: false, patterns: [] }

  const rawText = await readFile(filepath, 'utf-8')
  const workspace = parsePnpmWorkspaceYaml(rawText).toJSON() as PnpmWorkspaceConfig

  return {
    hasWorkspaceConfig: true,
    patterns: normalizeWorkspacePatterns(workspace.packages),
  }
}

async function readPackageJsonWorkspacePatterns(
  options: CatalogOptions,
): Promise<{ hasWorkspaceConfig: boolean, patterns: string[] }> {
  const cwd = getCwd(options)
  const filepath = join(cwd, 'package.json')
  if (!existsSync(filepath))
    return { hasWorkspaceConfig: false, patterns: [] }

  const packageJson = await readJsonFile<PackageJson>(filepath)
  const workspaces = packageJson.workspaces

  if (Array.isArray(workspaces)) {
    return {
      hasWorkspaceConfig: true,
      patterns: normalizeWorkspacePatterns(workspaces),
    }
  }

  if (isObject(workspaces)) {
    return {
      hasWorkspaceConfig: true,
      patterns: normalizeWorkspacePatterns(workspaces.packages),
    }
  }

  return { hasWorkspaceConfig: false, patterns: [] }
}

function normalizeWorkspacePatterns(patterns?: string | string[]): string[] {
  if (!patterns)
    return []

  const items = Array.isArray(patterns) ? patterns : [patterns]
  return Array.from(new Set(items.filter((item): item is string => typeof item === 'string' && item.length > 0)))
}
