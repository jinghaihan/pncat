import type { CAC } from 'cac'
import type { CatalogOptions, RangeMode } from './types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { cac } from 'cac'
import { addCommand, cleanCommand, detectCommand, initCommand, migrateCommand, removeCommand, revertCommand } from './commands'
import { resolveConfig } from './config'
import { ADD_MODE_ALIAS, MODE_CHOICES, NAME, REMOVE_MODE_ALIAS, VERSION } from './constants'

try {
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
    .action(async (mode: RangeMode, options: Partial<CatalogOptions>) => {
      if (mode) {
        if (ADD_MODE_ALIAS.includes(mode))
          mode = 'add'
        else if (REMOVE_MODE_ALIAS.includes(mode))
          mode = 'remove'

        if (!MODE_CHOICES.includes(mode)) {
          console.error(`Invalid mode: ${mode}. Please use one of the following: ${MODE_CHOICES.join(', ')}`)
          process.exit(1)
        }
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
    })

  cli.help()
  cli.version(VERSION)
  cli.parse()
}
catch (error) {
  console.error(error)
  process.exit(1)
}
