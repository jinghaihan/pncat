import type { CatalogOptions, DepFilter, PackageManager, RawDep, WorkspacePackageMeta } from '../types'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { findUp } from 'find-up'
import { dirname, join, resolve } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { WORKSPACE_DEFAULT_CONTENT, WORKSPACE_FILES } from '../constants'
import { parseDependency } from './dependencies'

export async function findWorkspaceRoot(packageManager: PackageManager = 'pnpm'): Promise<string> {
  const workspaceYamlPath = await findWorkspaceYAML(packageManager)
  if (workspaceYamlPath)
    return dirname(workspaceYamlPath)

  return process.cwd()
}

export async function findWorkspaceYAML(packageManager: PackageManager = 'pnpm'): Promise<string | undefined> {
  if (packageManager === 'pnpm')
    return await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
  if (packageManager === 'yarn')
    return await findUp('.yarnrc.yml', { cwd: process.cwd() })
}

export async function ensureWorkspaceYAML(packageManager: PackageManager = 'pnpm') {
  let workspaceYamlPath = await findWorkspaceYAML(packageManager)
  const workspaceFile = WORKSPACE_FILES[packageManager]

  if (!workspaceYamlPath) {
    const root = await findUp(['.git', 'pnpm-lock.yaml', 'yarn.lock'], { cwd: process.cwd() })
      .then(r => r ? dirname(r) : process.cwd())
    p.log.warn(c.yellow(`no ${workspaceFile} found`))

    const result = await p.confirm({
      message: `do you want to create it under project root ${c.dim(root)} ?`,
    })
    if (!result) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }

    workspaceYamlPath = join(root, workspaceFile)
    await writeFile(workspaceYamlPath, WORKSPACE_DEFAULT_CONTENT[packageManager])
  }

  const workspaceYaml = parsePnpmWorkspaceYaml(await readFile(workspaceYamlPath, 'utf-8'))
  return { workspaceYaml: workspaceYaml!, workspaceYamlPath: workspaceYamlPath! }
}

export async function loadWorkspace(relative: string, options: CatalogOptions, shouldCatalog: DepFilter): Promise<WorkspacePackageMeta[]> {
  const { packageManager = 'pnpm' } = options
  const workspaceFile = WORKSPACE_FILES[packageManager]

  const filepath = resolve(options.cwd ?? '', relative)
  const rawText = await readFile(filepath, 'utf-8')
  const context = parsePnpmWorkspaceYaml(rawText)
  const raw = context.getDocument().toJSON()

  const catalogs: WorkspacePackageMeta[] = []

  function createWorkspaceEntry(name: string, map: Record<string, string>): WorkspacePackageMeta {
    const deps: RawDep[] = Object.entries(map)
      .map(([pkg, version]) => parseDependency(
        pkg,
        version,
        `${packageManager}-workspace`,
        shouldCatalog,
        options,
        [],
        name,
      ))

    return {
      name,
      private: true,
      version: '',
      type: workspaceFile,
      relative,
      filepath,
      raw,
      context,
      deps,
    } satisfies WorkspacePackageMeta
  }

  if (raw?.catalog) {
    catalogs.push(createWorkspaceEntry(`${packageManager}-catalog:default`, raw.catalog))
  }

  if (raw?.catalogs) {
    for (const key of Object.keys(raw.catalogs)) {
      catalogs.push(createWorkspaceEntry(`${packageManager}-catalog:${key}`, raw.catalogs[key]))
    }
  }

  if (raw?.overrides) {
    catalogs.push(createWorkspaceEntry(`${packageManager}-workspace:overrides`, raw.overrides))
  }

  return catalogs
}
