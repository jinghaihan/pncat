import type { BunWorkspaceMeta, CatalogOptions, DepFilter, RawDep, WorkspaceSchema } from '../types'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'pathe'
import { parseDependency } from '../io/dependencies'
import { detectWorkspaceRoot } from '../io/workspace'
import { JsonCatalog } from './json-workspace'

export class BunCatalog extends JsonCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<BunWorkspaceMeta[]> {
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
      const workspaceRoot = await detectWorkspaceRoot(this.agent)
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
