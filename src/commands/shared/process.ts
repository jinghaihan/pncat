import type { Agent } from 'package-manager-detector'
import type { CatalogOptions, HookFunction } from '../../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import * as p from '@clack/prompts'
import { resolveCommand } from 'package-manager-detector'
import { x } from 'tinyexec'
import { CMD_BOOL_FLAGS, CMD_BOOL_SHORT_FLAGS } from '../../constants'

export interface AgentCommandOptions extends Pick<CatalogOptions, 'agent' | 'cwd' | 'recursive'> {
  stdio?: 'inherit' | 'pipe' | 'ignore'
  silent?: boolean
}

export interface ParsedCommandOptions {
  deps: string[]
  isRecursive: boolean
  isDev: boolean
  isOptional: boolean
  isPeer: boolean
  isExact: boolean
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

export async function runAgentRemove(dependencies: string[], options: AgentCommandOptions = {}): Promise<void> {
  const {
    agent = 'pnpm',
    cwd = process.cwd(),
    recursive = false,
    stdio = 'inherit',
  } = options

  if (dependencies.length === 0)
    return

  const args = [...dependencies]
  if (recursive)
    args.push('--recursive')

  const execOptions = {
    nodeOptions: {
      cwd,
      stdio,
    },
  }
  const fallbackRemove = async () => await x(agent, ['remove', ...args], execOptions)

  try {
    const resolved = resolveCommand(agent as Agent, 'uninstall', args)
    if (resolved)
      await x(resolved.command, resolved.args, execOptions)
    else
      await fallbackRemove()
  }
  catch {
    await fallbackRemove()
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

export function parseCommandOptions(args: string[], options: CatalogOptions = {}): ParsedCommandOptions {
  const { deps } = parseArgs(args)
  const isRecursive = ['--recursive', '-r'].some(flag => args.includes(flag))
  const isProd = ['--save-prod', '-P'].some(flag => args.includes(flag))
  const isDev = ['--save-dev', '-D'].some(flag => args.includes(flag))
  const isOptional = ['--save-optional', '-O'].some(flag => args.includes(flag))
  const isPeer = ['--save-peer'].some(flag => args.includes(flag))
  const isExact = ['--save-exact', '-E'].some(flag => args.includes(flag))

  return {
    deps,
    isRecursive,
    isDev: !isProd && isDev,
    isOptional: !isProd && isOptional,
    isPeer: !isProd && isPeer,
    isExact: !!options.saveExact || isExact,
  }
}

function parseArgs(args: string[]): { options: Record<string, unknown>, deps: string[] } {
  const options: Record<string, unknown> = {}
  const deps: string[] = []
  let index = 0

  while (index < args.length) {
    const arg = args[index]

    if (arg === '--') {
      deps.push(...args.slice(index + 1))
      break
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (key.startsWith('no-')) {
        options[key.slice(3)] = false
        index++
        continue
      }

      if (CMD_BOOL_FLAGS.has(key)) {
        options[key] = true
        index++
        continue
      }

      if (index + 1 < args.length && !args[index + 1].startsWith('-')) {
        options[key] = args[index + 1]
        index += 2
      }
      else {
        options[key] = true
        index++
      }
      continue
    }

    if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)
      if (CMD_BOOL_SHORT_FLAGS.has(key)) {
        options[key] = true
        index++
        continue
      }

      if (index + 1 < args.length && !args[index + 1].startsWith('-')) {
        options[key] = args[index + 1]
        index += 2
      }
      else {
        options[key] = true
        index++
      }
      continue
    }

    deps.push(arg)
    index++
  }

  return { options, deps }
}
