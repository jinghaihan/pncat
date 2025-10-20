import type { PackageManager } from '../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import { findUp } from 'find-up-simple'
import { detect } from 'package-manager-detector/detect'
import { PACKAGE_MANAGERS, WORKSPACE_META } from '../constants'

export async function detectPackageManager(cwd: string = process.cwd()): Promise<PackageManager | undefined> {
  const packageManager = await detect({ cwd })

  const name = packageManager?.name as PackageManager

  if (packageManager && PACKAGE_MANAGERS.includes(name))
    return name

  // vlt workspace
  if (await findUp('vlt.json', { cwd }))
    return 'vlt'

  const files = toArray(WORKSPACE_META.vlt.lock)
  for (const file of files) {
    const filepath = await findUp(file, { cwd })
    if (filepath)
      return 'vlt'
  }
}
