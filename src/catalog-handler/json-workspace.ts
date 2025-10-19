import type { CatalogHandler, CatalogOptions, RawDep, WorkspaceSchema } from '../types'
import type { Workspace } from '../workspace-manager'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { findUp } from 'find-up-simple'
import { join } from 'pathe'
import { WORKSPACE_META } from '../constants'
import { detectIndent, writeJSON } from '../io/packages'
import { findWorkspaceRoot } from '../io/workspace'

export class JsonCatalog implements CatalogHandler {
  public workspace: Workspace
  public options: CatalogOptions
  public packageManager: 'bun' | 'vlt'

  public workspaceJson: WorkspaceSchema | null = null
  public workspaceJsonPath: string | null = null

  constructor(workspace: Workspace) {
    this.workspace = workspace
    this.options = workspace.getOptions()
    this.packageManager = (this.options.packageManager || 'bun') as 'bun' | 'vlt'
  }

  async findWorkspaceFile(): Promise<string | undefined> {
    if (this.packageManager === 'vlt')
      return await findUp('vlt.json', { cwd: process.cwd() })
  }

  async ensureWorkspace(): Promise<void> {
    const workspaceMeta = WORKSPACE_META[this.packageManager]

    let filepath = await this.findWorkspaceFile()
    const workspaceFile = workspaceMeta.type

    if (!filepath) {
      const root = await findWorkspaceRoot(this.packageManager)
      p.log.warn(c.yellow(`no ${workspaceFile} found`))

      const result = await p.confirm({
        message: `do you want to create it under project root ${c.dim(root)} ?`,
      })
      if (!result) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }

      filepath = join(root, workspaceFile)
      await writeFile(filepath, workspaceMeta.defaultContent)
    }

    this.workspaceJson = JSON.parse(await readFile(filepath, 'utf-8'))
    this.workspaceJsonPath = filepath
  }

  async toJSON(): Promise<WorkspaceSchema> {
    await this.cleanupCatalogs()
    return await this.getWorkspaceJson()
  }

  async toString(): Promise<string> {
    await this.cleanupCatalogs()

    const filepath = await this.getWorkspacePath()
    const fileIndent = await detectIndent(filepath)

    const workspaceJson = await this.getWorkspaceJson()
    return `${JSON.stringify(workspaceJson, null, fileIndent)}`
  }

  async setPackage(catalog: 'default' | (string & {}), packageName: string, specifier: string) {
    const workspaceJson = await this.getWorkspaceJson()
    const useCatalogsDefault = workspaceJson.catalogs?.default !== undefined
    // Simply set the package in the specified catalog, overriding any existing value
    if (catalog === 'default' && !useCatalogsDefault) {
      workspaceJson.catalog ??= {}
      workspaceJson.catalog[packageName] = specifier
    }
    else {
      workspaceJson.catalogs ??= {}
      workspaceJson.catalogs[catalog] ??= {}
      workspaceJson.catalogs[catalog][packageName] = specifier
    }
  }

  async removePackages(deps: RawDep[]) {
    const workspaceJson = await this.getWorkspaceJson()
    deps.forEach((dep) => {
      if (dep.catalogName === 'default') {
        if (workspaceJson.catalog?.[dep.name])
          delete workspaceJson.catalog[dep.name]
      }
      else
        if (workspaceJson.catalogs?.[dep.catalogName]?.[dep.name]) {
          delete workspaceJson.catalogs[dep.catalogName][dep.name]
        }
    })
    this.cleanupCatalogs()
  }

  async getPackageCatalogs(name: string): Promise<string[]> {
    const catalogs: string[] = []
    const workspaceJson = await this.getWorkspaceJson()
    if (workspaceJson.catalogs) {
      for (const catalog of Object.keys(workspaceJson.catalogs)) {
        if (workspaceJson.catalogs[catalog]?.[name]) {
          catalogs.push(catalog)
        }
      }
    }
    if (workspaceJson.catalog) {
      if (workspaceJson.catalog[name]) {
        catalogs.push('default')
      }
    }
    return catalogs
  }

  async generateCatalogs(deps: RawDep[]) {
    await this.clearCatalogs()
    const workspaceJson = await this.getWorkspaceJson()

    const catalogs: Record<string, Record<string, string>> = {}
    for (const dep of deps) {
      if (!catalogs[dep.catalogName])
        catalogs[dep.catalogName] = {}
      catalogs[dep.catalogName][dep.name] = dep.specifier
    }

    Object.entries(catalogs)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([catalogName, deps]) => {
        Object.entries(deps).forEach(([name, specifier]) => {
          if (catalogName === 'default') {
            workspaceJson.catalog ??= {}
            workspaceJson.catalog[name] = specifier
          }
          else {
            workspaceJson.catalogs ??= {}
            workspaceJson.catalogs[catalogName] ??= {}
            workspaceJson.catalogs[catalogName][name] = specifier
          }
        })
      })
  }

  async cleanupCatalogs() {
    const workspaceJson = await this.getWorkspaceJson()

    if (workspaceJson.catalog && !Object.keys(workspaceJson.catalog).length)
      delete workspaceJson.catalog

    if (workspaceJson.catalogs) {
      const emptyCatalogs: string[] = []
      for (const [catalogKey, catalogValue] of Object.entries(workspaceJson.catalogs)) {
        if (!catalogValue || Object.keys(catalogValue).length === 0)
          emptyCatalogs.push(catalogKey)
      }

      emptyCatalogs.forEach((key) => {
        delete workspaceJson.catalogs![key]
      })
    }

    if (!workspaceJson.catalogs || Object.keys(workspaceJson.catalogs).length === 0) {
      delete workspaceJson.catalogs
    }
  }

  async clearCatalogs() {
    const workspaceJson = await this.getWorkspaceJson()

    delete workspaceJson.catalog
    delete workspaceJson.catalogs

    workspaceJson.catalogs ??= {}
    workspaceJson.catalog ??= {}
  }

  async getWorkspacePath(): Promise<string> {
    if (this.workspaceJsonPath)
      return this.workspaceJsonPath

    await this.ensureWorkspace()
    return this.workspaceJsonPath!
  }

  async writeWorkspace() {
    this.cleanupCatalogs()

    const filepath = await this.getWorkspacePath()
    const rawContent = await readFile(filepath, 'utf-8')
    const raw = JSON.parse(rawContent)

    const workspaceJson = await this.getWorkspaceJson()

    if (this.packageManager === 'bun') {
      raw.workspaces = workspaceJson
    }
    else {
      raw.catalog = workspaceJson.catalog
      raw.catalogs = workspaceJson.catalogs
    }

    await writeJSON(filepath, raw)
  }

  async getWorkspaceJson(): Promise<WorkspaceSchema> {
    if (this.workspaceJson)
      return this.workspaceJson

    await this.ensureWorkspace()
    return this.workspaceJson!
  }
}
