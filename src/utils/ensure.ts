import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { findUp } from 'find-up'
import { dirname, join } from 'pathe'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import { findWorkspaceYaml } from './workspace'

export async function ensurePnpmWorkspaceYAML() {
  let pnpmWorkspaceYamlPath = await findWorkspaceYaml()
  if (!pnpmWorkspaceYamlPath) {
    const root = await findUp(['.git', 'pnpm-lock.yaml'], { cwd: process.cwd() })
      .then(r => r ? dirname(r) : process.cwd())
    p.log.warn(c.yellow('No pnpm-workspace.yaml found'))
    const result = await p.confirm({
      message: `do you want to create it under project root ${c.dim(root)} ?`,
    })
    if (!result) {
      p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
      process.exit(1)
    }
    pnpmWorkspaceYamlPath = join(root, 'pnpm-workspace.yaml')
    await writeFile(pnpmWorkspaceYamlPath, 'packages: []')
  }

  const context = parsePnpmWorkspaceYaml(await readFile(pnpmWorkspaceYamlPath, 'utf-8'))

  return {
    context: context!,
    pnpmWorkspaceYamlPath: pnpmWorkspaceYamlPath!,
  }
}
