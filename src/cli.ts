import type { CAC } from 'cac'
import type { CatalogOptions, RangeMode } from './types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { cac } from 'cac'
import { version } from '../package.json'
import { addCommand, cleanCommand, detectCommand, migrateCommand, removeCommand, revertCommand } from './commands'
import { resolveConfig } from './config'
import { MODE_CHOICES } from './constants'

try {
  const cli: CAC = cac('pncat')

  cli
    .command('[mode]', 'Enhanced pnpm catalogs management with advanced workspace dependency control')
    .option('--recursive, -r', 'recursively search for package.json in subdirectories')
    .option('--force, -f', 'force cataloging according to rules, ignoring original configurations')
    .option('--ignore-paths <paths>', 'ignore paths for search package.json')
    .option('--ignore-other-workspaces', 'ignore package.json that in other workspaces (with their own .git,pnpm-workspace.yaml,etc.)', { default: true })
    .option('--include, -n <deps>', 'only included dependencies will be checked for catalog')
    .option('--exclude, -x <deps>', 'exclude dependencies to be checked, will override --include options')
    .option('--yes', 'skip prompt confirmation')
    .option('--install', 'install dependencies after execution')
    .allowUnknownOptions()
    .action(async (mode: RangeMode, options: Partial<CatalogOptions>) => {
      if (mode) {
        if (!MODE_CHOICES.includes(mode)) {
          console.error(`Invalid mode: ${mode}. Please use one of the following: ${MODE_CHOICES.join('|')}`)
          process.exit(1)
        }
        options.mode = mode
      }

      p.intro(`${c.yellow`pncat `}${c.dim`v${version}`}`)

      const resolved = await resolveConfig(options)

      switch (resolved.mode) {
        case 'detect':
          await detectCommand(resolved)
          break
        case 'migrate':
          await migrateCommand(resolved)
          break
        case 'add':
          await addCommand(resolved)
          break
        case 'remove':
          await removeCommand(resolved)
          break
        case 'clean':
          await cleanCommand(resolved)
          break
        case 'revert':
          await revertCommand(resolved)
          break
      }
    })

  cli.help()
  cli.version(version)
  cli.parse()
}
catch (error) {
  console.error(error)
  process.exit(1)
}
