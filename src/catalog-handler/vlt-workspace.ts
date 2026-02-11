import type { CatalogOptions, DepFilter, PackageJson, RawDep, VltWorkspaceMeta } from '@/types'
import { resolve } from 'pathe'
import { JsonCatalog } from '@/catalog-handler/base/json-workspace'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { readJsonFile } from '@/io'
import { getCwd, parseDependency } from '@/utils'

export class VltCatalog extends JsonCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<VltWorkspaceMeta[] | null> {
    if (!relative.endsWith(PACKAGE_MANAGER_CONFIG.vlt.filename))
      return null

    const filepath = resolve(getCwd(options), relative)
    const raw = await readJsonFile<PackageJson>(filepath)

    const catalogs: VltWorkspaceMeta[] = []
    function createVltWorkspaceEntry(name: string, map: Record<string, string>): VltWorkspaceMeta {
      const deps: RawDep[] = Object.entries(map).map(([pkg, version]) => parseDependency(
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
      }
    }

    if (raw.catalog)
      catalogs.push(createVltWorkspaceEntry('vlt-catalog:default', raw.catalog))

    if (raw.catalogs) {
      for (const key of Object.keys(raw.catalogs))
        catalogs.push(createVltWorkspaceEntry(`vlt-catalog:${key}`, raw.catalogs[key]))
    }

    return catalogs
  }

  constructor(options: CatalogOptions) {
    super(options, 'vlt')
  }
}
