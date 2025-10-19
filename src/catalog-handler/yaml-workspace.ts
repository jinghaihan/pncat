import type { CatalogHandler, CatalogOptions, RawDep, WorkspaceSchema, WorkspaceYaml } from '../types'
import type { Workspace } from '../workspace-manager'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { findUp } from 'find-up-simple'
import { join } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { WORKSPACE_META } from '../constants'
import { findWorkspaceRoot } from '../io/workspace'

export class YamlCatalog implements CatalogHandler {
  public workspace: Workspace
  public options: CatalogOptions
  public packageManager: 'pnpm' | 'yarn'

  public workspaceYaml: WorkspaceYaml | null = null
  public workspaceYamlPath: string | null = null

  constructor(workspace: Workspace) {
    this.options = workspace.getOptions()
    this.packageManager = (this.options.packageManager || 'pnpm') as 'pnpm' | 'yarn'
    this.workspace = workspace
  }

  async findWorkspaceFile(): Promise<string | undefined> {
    if (this.packageManager === 'pnpm')
      return await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
    if (this.packageManager === 'yarn')
      return await findUp('.yarnrc.yml', { cwd: process.cwd() })
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

    this.workspaceYaml = parsePnpmWorkspaceYaml(await readFile(filepath, 'utf-8'))
    this.workspaceYamlPath = filepath
  }

  async toJSON(): Promise<WorkspaceSchema> {
    const workspaceYaml = await this.getWorkspaceYaml()
    return workspaceYaml.toJSON()
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
    deps.forEach((dep) => {
      if (dep.catalogName === 'default') {
        if (document.getIn(['catalog', dep.name]))
          document.deleteIn(['catalog', dep.name])
      }
      else
        if (document.getIn(['catalogs', dep.catalogName, dep.name])) {
          document.deleteIn(['catalogs', dep.catalogName, dep.name])
        }
    })
    this.cleanupCatalogs()
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
      if (!catalogs[dep.catalogName])
        catalogs[dep.catalogName] = {}
      catalogs[dep.catalogName][dep.name] = dep.specifier
    }

    Object.entries(catalogs)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([catalogName, deps]) => {
        Object.entries(deps).forEach(([name, specifier]) => {
          if (catalogName === 'default')
            workspaceYaml.setPath(['catalog', name], specifier)
          else
            workspaceYaml.setPath(['catalogs', catalogName, name], specifier)
        })
      })
  }

  async cleanupCatalogs() {
    const workspaceYaml = await this.getWorkspaceYaml()

    const document = workspaceYaml.getDocument()
    const workspaceJson = workspaceYaml.toJSON()

    if (workspaceJson.catalog && !Object.keys(workspaceJson.catalog).length)
      document.deleteIn(['catalog'])

    if (workspaceJson.catalogs) {
      const emptyCatalogs: string[] = []
      for (const [catalogKey, catalogValue] of Object.entries(workspaceJson.catalogs)) {
        if (!catalogValue || Object.keys(catalogValue).length === 0)
          emptyCatalogs.push(catalogKey)
      }

      emptyCatalogs.forEach((key) => {
        document.deleteIn(['catalogs', key])
      })
    }

    const updatedWorkspaceJson = workspaceYaml.toJSON()
    if (!updatedWorkspaceJson.catalogs || Object.keys(updatedWorkspaceJson.catalogs).length === 0) {
      document.deleteIn(['catalogs'])
    }
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

  async getWorkspaceYaml(): Promise<WorkspaceYaml> {
    if (this.workspaceYaml)
      return this.workspaceYaml

    await this.ensureWorkspace()
    return this.workspaceYaml!
  }
}
