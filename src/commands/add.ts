import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { ensurePackage } from '../utils/ensure'
import { getDepCatalogName } from '../utils/rule'

interface AddCommandConfig {
  dependency: string
  isDev: boolean
  hasCatalogFlag: boolean
  processedArgs: string[]
}

export async function addCommand(options: CatalogOptions) {
  // Ensure @antfu/nip is available and import it
  await ensurePackage('@antfu/nip')
  await import('@antfu/nip')

  // Get command line arguments (skip node and script name)
  const rawArgs = process.argv.slice(3)
  if (rawArgs.length === 0) {
    p.outro(c.red('no arguments provided, aborting'))
    process.exit(1)
  }

  // Process and validate arguments
  const config = processArguments(rawArgs)

  // Determine catalog name if not already specified
  if (!config.hasCatalogFlag) {
    const catalogName = determineCatalogName(config.dependency, config.isDev, options)
    config.processedArgs.push('--catalog', catalogName)
  }

  // Normalize dev dependency flags for nip
  const normalizedArgs = normalizeDevFlags(config.processedArgs, config.isDev)

  // Execute nip command with processed arguments
  await execa('nip', normalizedArgs, {
    stdio: 'inherit',
  })

  p.log.success('add complete')
}

function processArguments(args: string[]): AddCommandConfig {
  const isDev = ['--save-dev', '-D'].some(flag => args.includes(flag))
  const hasCatalogFlag = args.includes('--catalog')

  // Extract dependency name (first non-flag argument)
  const dependency = args.find(arg => !arg.startsWith('-'))

  if (!dependency) {
    p.outro(c.red('no dependency provided, aborting'))
    process.exit(1)
  }

  return {
    dependency,
    isDev,
    hasCatalogFlag,
    processedArgs: [...args],
  }
}

function determineCatalogName(dependency: string, isDev: boolean, options: CatalogOptions): string {
  return getDepCatalogName({
    name: dependency,
    specifier: '',
    source: isDev ? 'devDependencies' : 'dependencies',
    catalog: true,
  }, options)
}

function normalizeDevFlags(args: string[], isDev: boolean): string[] {
  if (!isDev)
    return args

  const normalizedArgs = [...args]

  // Replace --save-dev with -d for nip compatibility
  const saveDevIndex = normalizedArgs.indexOf('--save-dev')
  if (saveDevIndex !== -1)
    normalizedArgs[saveDevIndex] = '-d'

  // Replace -D with -d for nip compatibility
  const devIndex = normalizedArgs.indexOf('-D')
  if (devIndex !== -1)
    normalizedArgs[devIndex] = '-d'

  return normalizedArgs
}
