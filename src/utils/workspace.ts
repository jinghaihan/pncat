import process from 'node:process'
import { findUp } from 'find-up'
import { dirname } from 'pathe'

export async function findWorkspaceRoot(): Promise<string> {
  const pnpmWorkspaceYamlPath = await findWorkspaceYaml()
  if (pnpmWorkspaceYamlPath)
    return dirname(pnpmWorkspaceYamlPath)

  return process.cwd()
}

export async function findWorkspaceYaml(): Promise<string | undefined> {
  return await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
}
