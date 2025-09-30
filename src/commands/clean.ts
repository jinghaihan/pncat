import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { CatalogManager } from '../catalog-manager'
import { ensureWorkspaceYAML, findWorkspaceYAML } from '../io/workspace'
import { resolveClean } from '../utils/resolver'
import { confirmWorkspaceChanges, removeWorkspaceYAMLDeps } from '../utils/workspace'

export async function cleanCommand(options: CatalogOptions) {
  const workspaceYamlPath = await findWorkspaceYAML(options.packageManager)
  if (!workspaceYamlPath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }

  const catalogManager = new CatalogManager(options)
  const { dependencies = [] } = await resolveClean({
    options,
    catalogManager,
  })

  if (!dependencies.length) {
    p.outro(c.yellow('no dependencies to clean, aborting'))
    process.exit(0)
  }

  const { workspaceYaml } = await ensureWorkspaceYAML(options.packageManager)
  p.log.info(`📦 Found ${c.yellow(dependencies.length)} dependencies not in package.json`)

  await confirmWorkspaceChanges(
    async () => {
      removeWorkspaceYAMLDeps(dependencies, workspaceYaml)
    },
    {
      catalogManager,
      workspaceYaml,
      workspaceYamlPath,
      yes: options.yes,
      verbose: options.verbose,
      bailout: true,
      completeMessage: 'clean complete',
    },
  )
}
