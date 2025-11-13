import type { CatalogOptions, DepFilter, RawDep, VltWorkspaceMeta } from '../types'
import { readFile } from 'node:fs/promises'
import { resolve } from 'pathe'
import { parseDependency } from '../io/dependencies'
import { JsonCatalog } from './json-workspace'

export class VltCatalog extends JsonCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<VltWorkspaceMeta[]> {
    const filepath = resolve(options.cwd ?? '', relative)
    const rawText = await readFile(filepath, 'utf-8')
    const raw = JSON.parse(rawText)

    const catalogs: VltWorkspaceMeta[] = []

    function createVltWorkspaceEntry(name: string, map: Record<string, string>): VltWorkspaceMeta {
      const deps: RawDep[] = Object.entries(map)
        .map(([pkg, version]) => parseDependency(
          pkg,
          version,
          'vlt-workspace',
          shouldCatalog,
          options,
          [],
          name,
        ))

      return {
        name,
        private: true,
        version: '',
        type: 'vlt.json',
        relative,
        filepath,
        raw,
        deps,
      } satisfies VltWorkspaceMeta
    }

    if (raw.catalog) {
      catalogs.push(createVltWorkspaceEntry('vlt-catalog:default', raw.catalog))
    }

    if (raw.catalogs) {
      for (const key of Object.keys(raw.catalogs)) {
        catalogs.push(createVltWorkspaceEntry(`vlt-catalog:${key}`, raw.catalogs[key]))
      }
    }

    return catalogs
  }
}
