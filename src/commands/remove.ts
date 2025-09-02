import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { ensureWorkspaceYAML, findWorkspaceYAML } from '../io/workspace'
import { PnpmCatalogManager } from '../pnpm-catalog-manager'
import { resolveRemove } from '../utils/resolver'
import { confirmWorkspaceChanges, removeWorkspaceYAMLDeps } from '../utils/workspace'

export async function removeCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)
  if (args.length === 0) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const workspaceYamlPath = await findWorkspaceYAML()
  if (!workspaceYamlPath) {
    p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
    process.exit(1)
  }

  const { workspaceYaml } = await ensureWorkspaceYAML()
  const pnpmCatalogManager = new PnpmCatalogManager(options)

  const { dependencies = [], updatedPackages = {} } = await resolveRemove(args, {
    options,
    pnpmCatalogManager,
    workspaceYaml,
  })

  await confirmWorkspaceChanges(
    async () => {
      removeWorkspaceYAMLDeps(dependencies, workspaceYaml)
    },
    {
      pnpmCatalogManager,
      workspaceYaml,
      workspaceYamlPath,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
      completeMessage: 'remove complete',
    },
  )
}
