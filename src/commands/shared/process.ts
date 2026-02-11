import type { Agent } from 'package-manager-detector'
import type { CatalogOptions, HookFunction } from '../../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import * as p from '@clack/prompts'
import { resolveCommand } from 'package-manager-detector'
import { x } from 'tinyexec'

export interface AgentCommandOptions extends Pick<CatalogOptions, 'agent' | 'cwd' | 'recursive'> {
  stdio?: 'inherit' | 'pipe' | 'ignore'
  silent?: boolean
}

export async function runAgentInstall(options: AgentCommandOptions = {}): Promise<void> {
  const {
    agent = 'pnpm',
    cwd = process.cwd(),
    stdio = 'inherit',
    silent = false,
  } = options

  if (!silent)
    p.outro(`running ${agent} install`)

  const execOptions = {
    nodeOptions: {
      cwd,
      stdio,
    },
  }
  const fallbackInstall = async () => await x(agent, ['install'], execOptions)

  try {
    const resolved = resolveCommand(agent as Agent, 'install', [])
    if (resolved)
      await x(resolved.command, resolved.args, execOptions)
    else
      await fallbackInstall()
  }
  catch {
    await fallbackInstall()
  }
}

export async function runHooks(
  hooks: string | HookFunction | Array<string | HookFunction>,
  options: { cwd?: string } = {},
): Promise<void> {
  const { cwd = process.cwd() } = options

  for (const hook of toArray(hooks)) {
    try {
      if (typeof hook === 'string') {
        p.log.info(`running hook: ${hook}`)
        await x(hook, [], {
          nodeOptions: {
            cwd,
            stdio: 'inherit',
            shell: true,
          },
        })
      }
      else {
        p.log.info('running custom hook function')
        await hook()
      }
    }
    catch {
      p.log.warn(`hook failed: ${typeof hook === 'string' ? hook : 'custom function'}`)
    }
  }
}
