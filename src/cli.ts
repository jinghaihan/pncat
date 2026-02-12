import type { CAC } from 'cac'
import type { CatalogOptions, RangeMode } from './types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { cac } from 'cac'
import { reportCommandError } from '@/commands/shared'
import {
  addCommand,
  cleanCommand,
  detectCommand,
  initCommand,
  migrateCommand,
  removeCommand,
  revertCommand,
} from './commands'
import { resolveConfig } from './config'
import { MODE_ALIASES, MODE_CHOICES, NAME, VERSION } from './constants'

const cli: CAC = cac(NAME)

cli
  .command('[mode]', 'A unified cli tool that enhances package managers catalogs feature')
  .option('--cwd <cwd>', 'specify the current working directory')
  .option('--catalog [name]', 'Install from a specific catalog, auto detect if not provided')
  .option('--recursive, -r', 'Recursively search for package.json in subdirectories')
  .option('--force, -f', 'Force cataloging according to rules, ignoring original configurations')
  .option('--include, -n <deps>', 'Only included dependencies will be checked for catalog')
  .option('--exclude, -x <deps>', 'Exclude dependencies to be checked, will override --include options')
  .option('--ignore-paths <paths>', 'Ignore paths for search package.json')
  .option('--yes', 'Skip prompt confirmation')
  .option('--install', 'Run install after command')
  .option('--verbose', 'Show complete catalogs instead of only the diff')
  .option('--post-run <hooks>', 'Hook to run after command completion')
  .allowUnknownOptions()
  .action((mode: RangeMode, options: Partial<CatalogOptions>) => runCliAction(mode, options).catch(handleCliError))

cli.help()
cli.version(VERSION)

async function runCliAction(mode: RangeMode, options: Partial<CatalogOptions>): Promise<void> {
  if (mode) {
    Object.entries(MODE_ALIASES).forEach(([key, value]: [string, string[]]) => {
      if (value.includes(mode))
        mode = key as RangeMode
    })

    if (!MODE_CHOICES.includes(mode))
      throw new Error(`invalid mode: ${mode}. please use one of the following: ${MODE_CHOICES.join(', ')}`)

    options.mode = mode
  }

  p.intro(`${c.yellow`${NAME} `}${c.dim`v${VERSION}`}`)
  const config = await resolveConfig(options)

  switch (config.mode) {
    case 'init':
      await initCommand(config)
      break
    case 'detect':
      await detectCommand(config)
      break
    case 'migrate':
      await migrateCommand(config)
      break
    case 'add':
      await addCommand(config)
      break
    case 'remove':
      await removeCommand(config)
      break
    case 'clean':
      await cleanCommand(config)
      break
    case 'revert':
      await revertCommand(config)
      break
  }
}

function handleCliError(error: unknown): never {
  reportCommandError(error)
  process.exit(1)
}

try {
  cli.parse()
}
catch (error) {
  handleCliError(error)
}
