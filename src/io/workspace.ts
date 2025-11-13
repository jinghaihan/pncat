import type { Agent } from '../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import { findUp } from 'find-up-simple'
import { dirname } from 'pathe'
import { AGENT_CONFIG } from '../constants'

export async function detectWorkspaceRoot(agent: Agent = 'pnpm'): Promise<string> {
  const root = await findUp('.git', { cwd: process.cwd() })
  if (root)
    return dirname(root)

  const lockFiles = toArray(AGENT_CONFIG[agent].lock)
  for (const file of lockFiles) {
    const filepath = await findUp(file, { cwd: process.cwd() })
    if (filepath)
      return dirname(filepath)
  }

  return process.cwd()
}
