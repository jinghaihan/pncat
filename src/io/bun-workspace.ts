import type { BunWorkspaceMeta, CatalogOptions, DepFilter, RawDep } from '../types'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { parseDependency } from './dependencies'

export async function loadBunWorkspace(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<BunWorkspaceMeta[]> {
  const filepath = resolve(options.cwd ?? '', relative)
  const rawText = await readFile(filepath, 'utf-8')
  const raw = JSON.parse(rawText)

  const catalogs: BunWorkspaceMeta[] = []

  function createBunWorkspaceEntry(name: string, map: Record<string, string>): BunWorkspaceMeta {
    const deps: RawDep[] = Object.entries(map)
      .map(([pkg, version]) => parseDependency(
        pkg,
        version,
        'bun-workspace',
        shouldCatalog,
        options,
        [],
        name,
      ))

    return {
      name,
      private: true,
      version: '',
      type: 'bun-workspace',
      relative,
      filepath,
      raw,
      deps,
    } satisfies BunWorkspaceMeta
  }

  // Handle Bun workspaces structure
  const workspaces = raw?.workspaces

  if (workspaces) {
    // Check if workspaces has catalog (singular)
    if (workspaces.catalog) {
      catalogs.push(createBunWorkspaceEntry('bun-catalog:default', workspaces.catalog))
    }

    // Check if workspaces has catalogs (plural)
    if (workspaces.catalogs) {
      for (const key of Object.keys(workspaces.catalogs)) {
        catalogs.push(createBunWorkspaceEntry(`bun-catalog:${key}`, workspaces.catalogs[key]))
      }
    }
  }

  return catalogs
}
