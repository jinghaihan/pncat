import type { CatalogHandler, CatalogOptions, RawDep, WorkspaceSchema } from '../../types'
import { readFile, writeFile } from 'node:fs/promises'
import { findUp } from 'find-up'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { AGENT_CONFIG } from '../../constants'
import { getCwd } from '../../utils'

type WorkspaceYamlContext = ReturnType<typeof parsePnpmWorkspaceYaml>

export class YamlCatalog implements CatalogHandler {
  public readonly options: CatalogOptions
  protected readonly agent: 'pnpm' | 'yarn'

  protected workspaceYaml: WorkspaceYamlContext | null = null
  protected workspaceYamlPath: string | null = null

  constructor(options: CatalogOptions, agent: 'pnpm' | 'yarn') {
    this.options = options
    this.agent = agent
  }

  async findWorkspaceFile(): Promise<string | undefined> {
    const filename = AGENT_CONFIG[this.agent].filename
    return await findUp(filename, { cwd: getCwd(this.options) })
  }

  async ensureWorkspace(): Promise<void> {
    const filepath = await this.findWorkspaceFile()
    if (!filepath)
      throw new Error(`No ${AGENT_CONFIG[this.agent].filename} found from ${getCwd(this.options)}`)

    const content = await readFile(filepath, 'utf-8')
    this.workspaceYaml = parsePnpmWorkspaceYaml(content)
    this.workspaceYamlPath = filepath
  }

  async toJSON(): Promise<WorkspaceSchema> {
    const workspaceYaml = await this.getWorkspaceYaml()
    return structuredClone(workspaceYaml.toJSON() as WorkspaceSchema)
  }

  async toString(): Promise<string> {
    const workspaceYaml = await this.getWorkspaceYaml()
    return workspaceYaml.toString()
  }

  async setPackage(catalog: 'default' | (string & {}), packageName: string, specifier: string) {
    const workspaceYaml = await this.getWorkspaceYaml()
    workspaceYaml.setPackage(catalog, packageName, specifier)
  }

  async removePackages(deps: RawDep[]) {
    const workspaceYaml = await this.getWorkspaceYaml()
    const document = workspaceYaml.getDocument()

    for (const dep of deps) {
      if (dep.catalogName === 'default') {
        if (document.getIn(['catalog', dep.name]))
          document.deleteIn(['catalog', dep.name])
      }
      else if (document.getIn(['catalogs', dep.catalogName, dep.name])) {
        document.deleteIn(['catalogs', dep.catalogName, dep.name])
      }
    }

    await this.cleanupCatalogs()
  }

  async getPackageCatalogs(name: string): Promise<string[]> {
    const workspaceYaml = await this.getWorkspaceYaml()
    return workspaceYaml.getPackageCatalogs(name)
  }

  async generateCatalogs(deps: RawDep[]) {
    await this.clearCatalogs()
    const workspaceYaml = await this.getWorkspaceYaml()

    const catalogs: Record<string, Record<string, string>> = {}
    for (const dep of deps) {
      catalogs[dep.catalogName] ??= {}
      catalogs[dep.catalogName][dep.name] = dep.specifier
    }

    for (const [catalogName, depMap] of Object.entries(catalogs).sort((a, b) => a[0].localeCompare(b[0]))) {
      for (const [name, specifier] of Object.entries(depMap)) {
        if (catalogName === 'default')
          workspaceYaml.setPath(['catalog', name], specifier)
        else
          workspaceYaml.setPath(['catalogs', catalogName, name], specifier)
      }
    }
  }

  async cleanupCatalogs() {
    const workspaceYaml = await this.getWorkspaceYaml()
    const document = workspaceYaml.getDocument()
    const workspaceJson = workspaceYaml.toJSON() as WorkspaceSchema

    if (workspaceJson.catalog && Object.keys(workspaceJson.catalog).length === 0)
      document.deleteIn(['catalog'])

    if (workspaceJson.catalogs) {
      for (const [catalogName, value] of Object.entries(workspaceJson.catalogs)) {
        if (!value || Object.keys(value).length === 0)
          document.deleteIn(['catalogs', catalogName])
      }
    }

    const nextJson = workspaceYaml.toJSON() as WorkspaceSchema
    if (!nextJson.catalogs || Object.keys(nextJson.catalogs).length === 0)
      document.deleteIn(['catalogs'])
  }

  async clearCatalogs() {
    const workspaceYaml = await this.getWorkspaceYaml()
    const document = workspaceYaml.getDocument()
    document.deleteIn(['catalog'])
    document.deleteIn(['catalogs'])
  }

  async getWorkspacePath(): Promise<string> {
    if (this.workspaceYamlPath)
      return this.workspaceYamlPath

    await this.ensureWorkspace()
    return this.workspaceYamlPath!
  }

  async writeWorkspace() {
    const workspaceYaml = await this.getWorkspaceYaml()
    const filepath = await this.getWorkspacePath()
    await writeFile(filepath, workspaceYaml.toString(), 'utf-8')
  }

  protected async getWorkspaceYaml(): Promise<WorkspaceYamlContext> {
    if (this.workspaceYaml)
      return this.workspaceYaml

    await this.ensureWorkspace()
    return this.workspaceYaml!
  }
}
