import type { CatalogOptions, PackageJsonMeta } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { ensureWorkspaceYAML } from '../io/workspace'
import { PnpmCatalogManager } from '../pnpm-catalog-manager'
import { runPnpmInstall } from '../utils/process'
import { resolveAdd } from '../utils/resolver'
import { confirmWorkspaceChanges, readPackageJSON } from '../utils/workspace'

export async function addCommand(options: CatalogOptions) {
  const args = process.argv.slice(3)
  if (args.length === 0) {
    p.outro(c.red('no dependencies provided, aborting'))
    process.exit(1)
  }

  const { pkgJson, pkgPath } = await readPackageJSON()
  const { workspaceYaml, workspaceYamlPath } = await ensureWorkspaceYAML()
  const pnpmCatalogManager = new PnpmCatalogManager(options)

  const { isDev = false, dependencies = [] } = await resolveAdd(args, {
    options,
    pnpmCatalogManager,
    workspaceYaml,
  })

  const depsName = isDev ? 'devDependencies' : 'dependencies'
  const depNameOppsite = isDev ? 'dependencies' : 'devDependencies'

  const deps = pkgJson[depsName] ||= {}
  for (const dep of dependencies) {
    deps[dep.name] = dep.catalogName ? (dep.catalogName === 'default' ? 'catalog:' : `catalog:${dep.catalogName}`) : dep.specifier || '^0.0.0'
    if (pkgJson[depNameOppsite]?.[dep.name])
      delete pkgJson[depNameOppsite][dep.name]
  }

  const updatedPackages: Record<string, PackageJsonMeta> = {
    [pkgJson.name as string]: { filepath: pkgPath, raw: pkgJson } as PackageJsonMeta,
  }

  await confirmWorkspaceChanges(
    async () => {
      for (const dep of dependencies) {
        if (dep.catalogName)
          workspaceYaml.setPackage(dep.catalogName, dep.name, dep.specifier || '^0.0.0')
      }
    },
    {
      pnpmCatalogManager,
      workspaceYaml,
      workspaceYamlPath,
      updatedPackages,
      yes: options.yes,
      verbose: options.verbose,
      bailout: false,
    },
  )

  p.log.success(c.green('add complete'))
  await runPnpmInstall({ cwd: pnpmCatalogManager.getCwd() })
}
