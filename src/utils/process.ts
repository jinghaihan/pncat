import type { CatalogOptions, HookFunction } from '../types'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import * as p from '@clack/prompts'
import { x } from 'tinyexec'

export interface PackageManagerCommandOptions extends Pick<CatalogOptions, 'packageManager' | 'cwd' | 'recursive'> {
  stdio?: 'inherit' | 'pipe' | 'ignore'
  silent?: boolean
}

export function parseArgs(args: string[]): { options: Record<string, unknown>, deps: string[] } {
  const options: Record<string, unknown> = {}
  const deps: string[] = []
  let i = 0

  while (i < args.length) {
    const arg = args[i]

    if (arg === '--') {
      deps.push(...args.slice(i + 1))
      break
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2)

      if (key.startsWith('no-')) {
        options[key.slice(3)] = false
        i++
      }
      else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[key] = args[i + 1]
        i += 2
      }
      else {
        options[key] = true
        i++
      }
    }
    else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)

      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[key] = args[i + 1]
        i += 2
      }
      else {
        options[key] = true
        i++
      }
    }
    else {
      deps.push(arg)
      i++
    }
  }

  return { options, deps }
}

export function parseCommandOptions(args: string[]) {
  const { deps } = parseArgs(args)
  const isRecursive = ['--recursive', '-r'].some(i => args.includes(i))
  const isDev = ['--save-dev', '-D'].some(i => args.includes(i))
  const isOptional = ['--save-optional', '-O'].some(i => args.includes(i))
  const isProd = ['--save-prod', '-P'].some(i => args.includes(i))

  return {
    deps,
    isRecursive,
    isDev,
    isOptional,
    isProd,
  }
}

/**
 * Execute install command
 */
export async function runInstallCommand(options: PackageManagerCommandOptions = {}) {
  const { packageManager = 'pnpm', cwd = process.cwd(), stdio = 'inherit', silent = false } = options
  if (!silent)
    p.outro(`running ${packageManager} install`)
  await x(packageManager, ['install'], {
    nodeOptions: {
      cwd,
      stdio,
    },
  })
}

/**
 * Execute add command
 */
export async function runRemoveCommand(dependencies: string[], options: PackageManagerCommandOptions = {}) {
  const { packageManager = 'pnpm', cwd = process.cwd(), recursive = false, stdio = 'inherit' } = options

  if (dependencies.length === 0)
    return

  const args = ['remove', ...dependencies]
  if (recursive)
    args.push('--recursive')

  await x(packageManager, args, {
    nodeOptions: {
      cwd,
      stdio,
    },
  })
}

export async function runHooks(hooks: string | HookFunction | Array<string | HookFunction>, options: { cwd?: string } = {}) {
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
      else if (typeof hook === 'function') {
        p.log.info('running custom hook function')
        await hook()
      }
    }
    catch {
      p.log.warn(`hook failed: ${typeof hook === 'string' ? hook : 'custom function'}`)
    }
  }
}
