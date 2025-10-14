import type { PackageManager } from '../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import { findUp } from 'find-up-simple'
import { dirname } from 'pathe'
import { WORKSPACE_META } from '../constants'

export async function findWorkspaceRoot(packageManager: PackageManager = 'pnpm'): Promise<string> {
  const root = await findUp('.git', { cwd: process.cwd() })
  if (root)
    return dirname(root)

  const files = toArray(WORKSPACE_META[packageManager].lockFile)
  for (const file of files) {
    const filepath = await findUp(file, { cwd: process.cwd() })
    if (filepath)
      return dirname(filepath)
  }

  return process.cwd()
}
