import type {
  BunWorkspaceMeta,
  CatalogOptions,
  DepFilter,
  PackageJson,
  PackageMeta,
  RawDep,
  WorkspaceSchema,
} from '../types'
import { existsSync } from 'node:fs'
import { join, resolve } from 'pathe'
import { PACKAGE_MANAGER_CONFIG } from '../constants'
import { detectWorkspaceRoot, loadPackageJSON, loadPackages, readJsonFile } from '../io'
import { getCwd, parseDependency } from '../utils'
import { JsonCatalog } from './base/json-workspace'

export class BunCatalog extends JsonCatalog {
  static async loadWorkspace(
    relative: string,
    options: CatalogOptions,
    shouldCatalog: DepFilter,
  ): Promise<PackageMeta[] | null> {
    if (!relative.endsWith(PACKAGE_MANAGER_CONFIG.bun.filename))
      return null

    const cwd = getCwd(options)
    if (!PACKAGE_MANAGER_CONFIG.bun.locks.some(lock => existsSync(join(cwd, lock))))
      return null

    const filepath = resolve(getCwd(options), relative)
    const raw = await readJsonFile<PackageJson>(filepath)

    const catalogs: BunWorkspaceMeta[] = []
    function createBunWorkspaceEntry(name: string, map: Record<string, string>): BunWorkspaceMeta {
      const deps: RawDep[] = Object.entries(map).map(([pkg, version]) => parseDependency(
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
      }
    }

    if (BunCatalog.hasWorkspaceCatalog(raw)) {
      const workspaces = raw.workspaces as {
        catalog?: Record<string, string>
        catalogs?: Record<string, Record<string, string>>
      }

      if (workspaces.catalog)
        catalogs.push(createBunWorkspaceEntry('bun-catalog:default', workspaces.catalog))

      if (workspaces.catalogs) {
        for (const key of Object.keys(workspaces.catalogs))
          catalogs.push(createBunWorkspaceEntry(`bun-catalog:${key}`, workspaces.catalogs[key]))
      }
    }

    if (catalogs.length === 0)
      return null

    const packageJson = await loadPackageJSON(relative, options, shouldCatalog)
    return [...catalogs, ...packageJson]
  }

  static hasWorkspaceCatalog(raw: { workspaces?: unknown }): boolean {
    const workspaces = raw.workspaces
    if (!workspaces || typeof workspaces !== 'object' || Array.isArray(workspaces))
      return false

    const workspaceObject = workspaces as Record<string, unknown>
    return !!(workspaceObject.catalog || workspaceObject.catalogs)
  }

  constructor(options: CatalogOptions) {
    super(options, 'bun')
  }

  override async findWorkspaceFile(): Promise<string | undefined> {
    const packages = await loadPackages({ ...this.options, agent: 'bun' })
    const bunWorkspace = packages.find(pkg => pkg.type === 'bun-workspace')
    return bunWorkspace?.filepath
  }

  override async ensureWorkspace(): Promise<void> {
    const filepath = await this.findWorkspaceFile()
    if (!filepath) {
      const workspaceRoot = await detectWorkspaceRoot(this.agent, getCwd(this.options))
      this.workspaceJsonPath = join(workspaceRoot, 'package.json')
      this.workspaceJson = {}
      return
    }

    const raw = await readJsonFile<PackageJson>(filepath)
    const workspaces = raw.workspaces

    if (workspaces && !Array.isArray(workspaces))
      this.workspaceJson = (workspaces as WorkspaceSchema) || {}
    else
      this.workspaceJson = {}

    this.workspaceJsonPath = filepath
  }
}
