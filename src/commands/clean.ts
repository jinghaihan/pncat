import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { ensureWorkspaceYAML, findWorkspaceYAML } from '../io/workspace'
import { PnpmCatalogManager } from '../pnpm-catalog-manager'
import { resolveClean } from '../utils/resolver'
import { confirmWorkspaceChanges, removeWorkspaceYAMLDeps } from '../utils/workspace'

export async function cleanCommand(options: CatalogOptions) {
  const workspaceYamlPath = await findWorkspaceYAML()
  if (!workspaceYamlPath) {
    p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
    process.exit(1)
  }

  const pnpmCatalogManager = new PnpmCatalogManager(options)
  const { dependencies = [] } = await resolveClean({
    options,
    pnpmCatalogManager,
  })

  if (!dependencies.length) {
    p.outro(c.yellow('no dependencies to clean, aborting'))
    process.exit(0)
  }

  const { workspaceYaml } = await ensureWorkspaceYAML()
  p.log.info(`📦 Found ${c.yellow(dependencies.length)} dependencies not in package.json`)

  await confirmWorkspaceChanges(
    async () => {
      removeWorkspaceYAMLDeps(dependencies, workspaceYaml)
    },
    {
      pnpmCatalogManager,
      workspaceYaml,
      workspaceYamlPath,
      yes: options.yes,
      verbose: options.verbose,
      bailout: true,
      completeMessage: 'clean complete',
    },
  )
}
