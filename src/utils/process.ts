import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import { execa } from 'execa'

export interface PnpmCommandOptions extends Pick<CatalogOptions, 'cwd' | 'recursive'> {
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

export function parsePnpmOptions(args: string[]) {
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
 * Execute pnpm install command
 */
export async function runPnpmInstall(options: PnpmCommandOptions = {}) {
  const { cwd = process.cwd(), stdio = 'inherit', silent = false } = options
  if (!silent)
    p.outro('running pnpm install')
  await execa('pnpm', ['install'], { stdio, cwd })
}

/**
 * Execute pnpm add command
 */
export async function runPnpmRemove(dependencies: string[], options: PnpmCommandOptions = {}) {
  const { cwd = process.cwd(), recursive = false, stdio = 'inherit' } = options

  if (dependencies.length === 0)
    return

  const args = ['remove', ...dependencies]
  if (recursive)
    args.push('--recursive')

  await execa('pnpm', args, { stdio, cwd })
}
