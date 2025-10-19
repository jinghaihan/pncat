import type { BunWorkspaceMeta, WorkspaceSchema } from '../types'
import { join } from 'pathe'
import { findWorkspaceRoot } from '../io/workspace'
import { JsonCatalog } from './json-workspace'

export class BunCatalog extends JsonCatalog {
  override async findWorkspaceFile(): Promise<string | undefined> {
    const { filepath } = await this.findBunWorkspace() ?? {}
    return filepath
  }

  override async ensureWorkspace() {
    const filepath = await this.findWorkspaceFile()
    if (filepath) {
      this.workspaceJsonPath = filepath
    }
    else {
      const workspaceRoot = await findWorkspaceRoot(this.packageManager)
      this.workspaceJsonPath = join(workspaceRoot, 'package.json')
    }

    const bunWorkspace = await this.findBunWorkspace()
    const workspaces = bunWorkspace?.raw.workspaces ?? {}
    if (!Array.isArray(workspaces))
      this.workspaceJson = workspaces as unknown as WorkspaceSchema
    else
      this.workspaceJson = {}
  }

  private async findBunWorkspace(): Promise<BunWorkspaceMeta | undefined> {
    const packages = await this.workspace.loadPackages()
    return packages.find(i => i.type === 'bun-workspace')
  }
}
