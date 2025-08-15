import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { findUp } from 'find-up'
import { dirname, join } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'

export async function findWorkspaceRoot(): Promise<string> {
  const workspaceYamlPath = await findWorkspaceYAML()
  if (workspaceYamlPath)
    return dirname(workspaceYamlPath)

  return process.cwd()
}

export async function findWorkspaceYAML(): Promise<string | undefined> {
  return await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
}

export async function ensureWorkspaceYAML() {
  let workspaceYamlPath = await findWorkspaceYAML()

  if (!workspaceYamlPath) {
    const root = await findUp(['.git', 'pnpm-lock.yaml'], { cwd: process.cwd() })
      .then(r => r ? dirname(r) : process.cwd())
    p.log.warn(c.yellow('no pnpm-workspace.yaml found'))

    const result = await p.confirm({
      message: `do you want to create it under project root ${c.dim(root)} ?`,
    })
    if (!result) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }

    workspaceYamlPath = join(root, 'pnpm-workspace.yaml')
    await writeFile(workspaceYamlPath, 'packages: []')
  }

  const workspaceYaml = parsePnpmWorkspaceYaml(await readFile(workspaceYamlPath, 'utf-8'))
  return { workspaceYaml: workspaceYaml!, workspaceYamlPath: workspaceYamlPath! }
}
