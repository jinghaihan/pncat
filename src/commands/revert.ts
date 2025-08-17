import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { ensureWorkspaceYAML, findWorkspaceYAML } from '../io/workspace'
import { PnpmCatalogManager } from '../pnpm-catalog-manager'
import { runPnpmInstall } from '../utils/process'
import { resolveRevert } from '../utils/resolver'
import { confirmWorkspaceChanges, removeWorkspaceYAMLDeps, writePackageJSONs, writePnpmWorkspace } from '../utils/workspace'

export async function revertCommand(options: CatalogOptions) {
  const args: string[] = process.argv.slice(3)

  const workspaceYamlPath = await findWorkspaceYAML()
  if (!workspaceYamlPath) {
    p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
    process.exit(1)
  }

  const { workspaceYaml } = await ensureWorkspaceYAML()
  const pnpmCatalogManager = new PnpmCatalogManager(options)

  const { isRevertAll, dependencies = [], updatedPackages = {} } = await resolveRevert(args, {
    options,
    pnpmCatalogManager,
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

    await writePnpmWorkspace(workspaceYamlPath, workspaceYaml.toString())
    await writePackageJSONs(updatedPackages)
  }
  else {
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
        bailout: true,
      },
    )
  }

  p.log.success(c.green('revert complete'))
  await runPnpmInstall({ cwd: pnpmCatalogManager.getCwd() })
}
