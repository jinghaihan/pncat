import type { PackageManager } from '../types'
import process from 'node:process'
import { findUp } from 'find-up-simple'
import { dirname } from 'pathe'
import { WORKSPACE_META } from '../constants'

export async function findWorkspaceRoot(packageManager: PackageManager = 'pnpm'): Promise<string> {
  const root = await findUp('.git', { cwd: process.cwd() })
  if (root)
    return dirname(root)

  const lockFile = WORKSPACE_META[packageManager].lockFile
  const filepath = await findUp(lockFile, { cwd: process.cwd() })
  if (filepath)
    return dirname(filepath)

  return process.cwd()
}
