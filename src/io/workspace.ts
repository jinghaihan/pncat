import type { PackageManager } from '../types'
import process from 'node:process'
import { findUp } from 'find-up-simple'
import { dirname } from 'pathe'

export async function findWorkspaceRoot(packageManager: PackageManager = 'pnpm'): Promise<string> {
  const root = await findUp('.git', { cwd: process.cwd() })
  if (root)
    return dirname(root)

  if (packageManager === 'pnpm') {
    const filepath = await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
    if (filepath)
      return dirname(filepath)
  }

  if (packageManager === 'yarn') {
    const filepath = await findUp('.yarnrc.yml', { cwd: process.cwd() })
    if (filepath)
      return dirname(filepath)
  }

  return process.cwd()
}
