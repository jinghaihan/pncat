import type { Agent } from '../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import { findUp } from 'find-up-simple'
import { detect } from 'package-manager-detector/detect'
import { AGENT_CONFIG, AGENTS } from '../constants'

export async function detectAgent(cwd: string = process.cwd()): Promise<Agent | undefined> {
  const agent = await detect({ cwd })
  if (!agent) {
    for (const file of toArray(AGENT_CONFIG.vlt.locks).concat(AGENT_CONFIG.vlt.filename)) {
      const filepath = await findUp(file, { cwd })
      if (filepath)
        return 'vlt'
    }
    return
  }

  const agentName = agent.name as Agent
  if (AGENTS.includes(agentName))
    return agentName
}
