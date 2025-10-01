import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { CatalogManager } from '../catalog-manager'
import { ensureWorkspaceYAML, findWorkspaceYAML } from '../io/workspace'
import { updatePnpmWorkspaceOverrides } from '../utils/overrides'
import { runInstallCommand } from '../utils/process'
import { resolveRevert } from '../utils/resolver'
import { confirmWorkspaceChanges, removeWorkspaceYAMLDeps, writePackageJSONs, writeWorkspace } from '../utils/workspace'

export async function revertCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)

  const workspaceYamlPath = await findWorkspaceYAML(options.packageManager)
  if (!workspaceYamlPath) {
    p.outro(c.red('no workspace file found, aborting'))
    process.exit(1)
  }

  const { workspaceYaml } = await ensureWorkspaceYAML(options.packageManager)
  const catalogManager = new CatalogManager(options)

  const { isRevertAll, dependencies = [], updatedPackages = {} } = await resolveRevert(args, {
    options,
    catalogManager,
    workspaceYaml,
  })

  if (isRevertAll) {
    if (!options.yes) {
      const result = await p.confirm({
        message: c.green('all catalog dependencies will be reverted, are you sure?'),
      })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }

    const document = workspaceYaml.getDocument()
    document.deleteIn(['catalog'])
    document.deleteIn(['catalogs'])

    // update pnpm-workspace.yaml overrides
    if (options.packageManager === 'pnpm') {
      await updatePnpmWorkspaceOverrides(workspaceYaml, catalogManager)
    }

    await writeWorkspace(workspaceYamlPath, workspaceYaml.toString())
    await writePackageJSONs(updatedPackages)

    if (options.install) {
      p.log.info(c.green('revert complete'))
      await runInstallCommand({
        cwd: catalogManager.getCwd(),
        packageManager: options.packageManager,
      })
    }
    else {
      p.outro(c.green('revert complete'))
    }
  }
  else {
    await confirmWorkspaceChanges(
      async () => {
        removeWorkspaceYAMLDeps(dependencies, workspaceYaml)
      },
      {
        catalogManager,
        workspaceYaml,
        workspaceYamlPath,
        updatedPackages,
        yes: options.yes,
        verbose: options.verbose,
        bailout: true,
        completeMessage: 'revert complete',
      },
    )
  }
}
