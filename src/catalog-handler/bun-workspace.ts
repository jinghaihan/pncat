import type { CatalogOptions, PackageJson, WorkspaceSchema } from '../types'
import { findNearestBunWorkspaceFile, readJsonFile } from '../io'
import { getCwd } from '../utils'
import { JsonCatalog } from './base/json-workspace'

export class BunCatalog extends JsonCatalog {
  constructor(options: CatalogOptions) {
    super(options, 'bun')
  }

  override async findWorkspaceFile(): Promise<string | undefined> {
    return await findNearestBunWorkspaceFile(getCwd(this.options))
  }

  override async ensureWorkspace(): Promise<void> {
    const filepath = await this.findWorkspaceFile()
    if (!filepath)
      throw new Error(`No Bun workspace package.json with workspaces.catalog found from ${getCwd(this.options)}`)

    const raw = await readJsonFile<PackageJson>(filepath)
    const workspaces = raw.workspaces

    if (workspaces && !Array.isArray(workspaces))
      this.workspaceJson = (workspaces as WorkspaceSchema) || {}
    else
      this.workspaceJson = {}

    this.workspaceJsonPath = filepath
  }
}
