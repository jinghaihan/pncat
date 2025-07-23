import type { CommonOptions, PnpmWorkspaceMeta, RawDep } from '../types'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { parseDependency } from './dependencies'

export async function loadPnpmWorkspace(
  relative: string,
  options: CommonOptions,
  shouldCatalog: (name: string, specifier: string) => boolean,
): Promise<PnpmWorkspaceMeta[]> {
  const filepath = resolve(options.cwd || '', relative)
  const rawText = await readFile(filepath, 'utf-8')
  const context = parsePnpmWorkspaceYaml(rawText)
  const raw = context.getDocument().toJSON()

  const catalogs: PnpmWorkspaceMeta[] = []

  function createPnpmWorkspaceEntry(name: string, map: Record<string, string>): PnpmWorkspaceMeta {
    const deps: RawDep[] = Object.entries(map)
      .map(([pkg, specifier]) => parseDependency(pkg, specifier, 'pnpm-workspace', shouldCatalog))

    return {
      name,
      relative,
      filepath,
      type: 'pnpm-workspace.yaml',
      raw,
      context,
      deps,
    } satisfies PnpmWorkspaceMeta
  }

  if (raw.catalog) {
    catalogs.push(
      createPnpmWorkspaceEntry('pnpm-catalog:default', raw.catalog),
    )
  }

  if (raw.catalogs) {
    for (const key of Object.keys(raw.catalogs)) {
      catalogs.push(
        createPnpmWorkspaceEntry(`pnpm-catalog:${key}`, raw.catalogs[key]),
      )
    }
  }

  if (raw.overrides) {
    catalogs.push(
      createPnpmWorkspaceEntry('pnpm-workspace:overrides', raw.overrides),
    )
  }

  return catalogs
}
