import type { CatalogOptions, DepFilter, RawDep, WorkspacePackageMeta } from '../types'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { WORKSPACE_META } from '../constants'
import { parseDependency } from './dependencies'

export async function loadWorkspaceYaml(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<WorkspacePackageMeta[]> {
  const { packageManager = 'pnpm' } = options
  const type = WORKSPACE_META[packageManager].type

  const filepath = resolve(options.cwd ?? '', relative)
  const rawText = await readFile(filepath, 'utf-8')
  const context = parsePnpmWorkspaceYaml(rawText)
  const raw = context.getDocument().toJSON()

  const catalogs: WorkspacePackageMeta[] = []

  function createWorkspaceEntry(name: string, map: Record<string, string>): WorkspacePackageMeta {
    const deps: RawDep[] = Object.entries(map)
      .map(([pkg, version]) => parseDependency(
        pkg,
        version,
        `${packageManager}-workspace`,
        shouldCatalog,
        options,
        [],
        name,
      ))

    return {
      name,
      private: true,
      version: '',
      type,
      relative,
      filepath,
      raw,
      context,
      deps,
    } satisfies WorkspacePackageMeta
  }

  if (raw?.catalog) {
    catalogs.push(createWorkspaceEntry(`${packageManager}-catalog:default`, raw.catalog))
  }

  if (raw?.catalogs) {
    for (const key of Object.keys(raw.catalogs)) {
      catalogs.push(createWorkspaceEntry(`${packageManager}-catalog:${key}`, raw.catalogs[key]))
    }
  }

  if (raw?.overrides) {
    catalogs.push(createWorkspaceEntry(`${packageManager}-workspace:overrides`, raw.overrides))
  }

  return catalogs
}
