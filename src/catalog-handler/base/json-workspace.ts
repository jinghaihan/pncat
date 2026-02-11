import type { CatalogHandler, CatalogOptions, RawDep, WorkspaceSchema } from '@/types'
import { findUp } from 'find-up'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { detectIndent, readJsonFile, writeJsonFile } from '@/io'
import { cloneDeep, getCwd } from '@/utils'

export class JsonCatalog implements CatalogHandler {
  public readonly options: CatalogOptions
  protected readonly agent: 'bun' | 'vlt'

  protected workspaceJson: WorkspaceSchema | null = null
  protected workspaceJsonPath: string | null = null

  constructor(options: CatalogOptions, agent: 'bun' | 'vlt') {
    this.options = options
    this.agent = agent
  }

  async findWorkspaceFile(): Promise<string | undefined> {
    const filename = PACKAGE_MANAGER_CONFIG[this.agent].filename
    return await findUp(filename, { cwd: getCwd(this.options) })
  }

  async ensureWorkspace(): Promise<void> {
    const filepath = await this.findWorkspaceFile()
    if (!filepath)
      throw new Error(`No ${PACKAGE_MANAGER_CONFIG[this.agent].filename} found from ${getCwd(this.options)}`)

    const raw = await readJsonFile<WorkspaceSchema>(filepath)
    this.workspaceJson = {
      catalog: raw.catalog,
      catalogs: raw.catalogs,
    }
    this.workspaceJsonPath = filepath
  }

  async toJSON(): Promise<WorkspaceSchema> {
    await this.cleanupCatalogs()
    const workspaceJson = await this.getWorkspaceJson()
    return cloneDeep(workspaceJson)
  }

  async toString(): Promise<string> {
    await this.cleanupCatalogs()
    const filepath = await this.getWorkspacePath()
    const indent = await detectIndent(filepath)
    return JSON.stringify(await this.getWorkspaceJson(), null, indent)
  }

  async setPackage(catalog: 'default' | (string & {}), packageName: string, specifier: string) {
    const workspaceJson = await this.getWorkspaceJson()
    const useCatalogsDefault = workspaceJson.catalogs?.default !== undefined

    if (catalog === 'default' && !useCatalogsDefault) {
      workspaceJson.catalog ??= {}
      workspaceJson.catalog[packageName] = specifier
      return
    }

    workspaceJson.catalogs ??= {}
    workspaceJson.catalogs[catalog] ??= {}
    workspaceJson.catalogs[catalog][packageName] = specifier
  }

  async removePackages(deps: RawDep[]) {
    const workspaceJson = await this.getWorkspaceJson()

    for (const dep of deps) {
      if (dep.catalogName === 'default') {
        if (workspaceJson.catalog?.[dep.name])
          delete workspaceJson.catalog[dep.name]
      }
      else if (workspaceJson.catalogs?.[dep.catalogName]?.[dep.name]) {
        delete workspaceJson.catalogs[dep.catalogName][dep.name]
      }
    }

    await this.cleanupCatalogs()
  }

  async getPackageCatalogs(name: string): Promise<string[]> {
    const catalogs: string[] = []
    const workspaceJson = await this.getWorkspaceJson()

    if (workspaceJson.catalogs) {
      for (const catalogName of Object.keys(workspaceJson.catalogs)) {
        if (workspaceJson.catalogs[catalogName]?.[name])
          catalogs.push(catalogName)
      }
    }

    if (workspaceJson.catalog?.[name])
      catalogs.push('default')

    return catalogs
  }

  async generateCatalogs(deps: RawDep[]) {
    await this.clearCatalogs()
    const workspaceJson = await this.getWorkspaceJson()

    const catalogs: Record<string, Record<string, string>> = {}
    for (const dep of deps) {
      catalogs[dep.catalogName] ??= {}
      catalogs[dep.catalogName][dep.name] = dep.specifier
    }

    for (const [catalogName, depMap] of Object.entries(catalogs).sort((a, b) => a[0].localeCompare(b[0]))) {
      for (const [name, specifier] of Object.entries(depMap)) {
        if (catalogName === 'default') {
          workspaceJson.catalog ??= {}
          workspaceJson.catalog[name] = specifier
        }
        else {
          workspaceJson.catalogs ??= {}
          workspaceJson.catalogs[catalogName] ??= {}
          workspaceJson.catalogs[catalogName][name] = specifier
        }
      }
    }
  }

  async cleanupCatalogs() {
    const workspaceJson = await this.getWorkspaceJson()

    if (workspaceJson.catalog && Object.keys(workspaceJson.catalog).length === 0)
      delete workspaceJson.catalog

    if (workspaceJson.catalogs) {
      for (const [catalogName, value] of Object.entries(workspaceJson.catalogs)) {
        if (!value || Object.keys(value).length === 0)
          delete workspaceJson.catalogs[catalogName]
      }
    }

    if (!workspaceJson.catalogs || Object.keys(workspaceJson.catalogs).length === 0)
      delete workspaceJson.catalogs
  }

  async clearCatalogs() {
    const workspaceJson = await this.getWorkspaceJson()
    delete workspaceJson.catalog
    delete workspaceJson.catalogs
  }

  async getWorkspacePath(): Promise<string> {
    if (this.workspaceJsonPath)
      return this.workspaceJsonPath

    await this.ensureWorkspace()
    return this.workspaceJsonPath!
  }

  async writeWorkspace() {
    await this.cleanupCatalogs()

    const filepath = await this.getWorkspacePath()
    const raw = await readJsonFile<Record<string, unknown>>(filepath)
    const workspaceJson = await this.getWorkspaceJson()

    if (this.agent === 'bun') {
      raw.workspaces = workspaceJson
    }
    else {
      raw.catalog = workspaceJson.catalog
      raw.catalogs = workspaceJson.catalogs
    }

    await writeJsonFile(filepath, raw)
  }

  protected async getWorkspaceJson(): Promise<WorkspaceSchema> {
    if (this.workspaceJson)
      return this.workspaceJson

    await this.ensureWorkspace()
    return this.workspaceJson!
  }
}
