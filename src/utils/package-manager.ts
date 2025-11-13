import type { Agent } from '../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import { findUp } from 'find-up-simple'
import { detect } from 'package-manager-detector/detect'
import { AGENT_CONFIG, AGENTS } from '../constants'

export async function detectAgent(cwd: string = process.cwd()): Promise<Agent | undefined> {
  const agent = await detect({ cwd })

  const name = agent?.name as Agent

  if (agent && AGENTS.includes(name))
    return name

  // vlt workspace
  if (await findUp('vlt.json', { cwd }))
    return 'vlt'

  const lockFiles = toArray(AGENT_CONFIG.vlt.lock)
  for (const file of lockFiles) {
    const filepath = await findUp(file, { cwd })
    if (filepath)
      return 'vlt'
  }
}
