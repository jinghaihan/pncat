import type { PackageManager } from '@/types'
import { findUp } from 'find-up'
import { detect } from 'package-manager-detector'
import { PACKAGE_MANAGER_CONFIG, PACKAGE_MANAGERS } from '@/constants'
import { getCwd } from './helper'

export async function detectPackageManager(dir?: string): Promise<PackageManager> {
  const cwd = getCwd({ cwd: dir })

  const agent = (await detect({ cwd }))?.name as PackageManager | undefined
  if (agent && PACKAGE_MANAGERS.includes(agent))
    return agent

  if (await isVltWorkspace(cwd))
    return 'vlt'

  return 'pnpm'
}

async function isVltWorkspace(cwd?: string): Promise<boolean> {
  const path = await findUp([PACKAGE_MANAGER_CONFIG.vlt.filename, ...PACKAGE_MANAGER_CONFIG.vlt.locks], { cwd: getCwd({ cwd }) })
  return !!path
}
