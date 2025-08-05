import type { CatalogOptions, PnpmWorkspaceMeta, RawDep } from '../types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { Scanner } from '../api/scanner'
import { ensurePnpmWorkspaceYAML } from '../utils/ensure'
import { findWorkspaceYaml } from '../utils/workspace'
import { cleanupCatalogs, safeYAMLDeleteIn } from '../utils/yaml'

interface DeletableCatalogs {
  catalogName: string
  name: string
  specifier: string
}

export async function cleanCommand(options: CatalogOptions) {
  const pnpmWorkspaceYamlPath = await findWorkspaceYaml()
  if (!pnpmWorkspaceYamlPath) {
    p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
    process.exit(1)
  }

  await Scanner(
    options,
    {
      afterPackagesLoaded: async (pkgs) => {
        const depsRecord: Record<string, RawDep[]> = {}
        const deletableCatalogs: DeletableCatalogs[] = []

        for (const pkg of pkgs) {
          if (pkg.type === 'pnpm-workspace.yaml')
            continue

          for (const dep of pkg.deps) {
            depsRecord[dep.name] ??= []
            depsRecord[dep.name].push(dep)
          }
        }

        const pnpmWorkspacePackages: PnpmWorkspaceMeta[] = pkgs.filter(pkg => pkg.type === 'pnpm-workspace.yaml')
        for (const pkg of pnpmWorkspacePackages) {
          for (const dep of pkg.deps) {
            const catalogSpecifier = pkg.name.replace('pnpm-catalog:', 'catalog:')
            if (!depsRecord[dep.name] || !depsRecord[dep.name].some(d => d.specifier === catalogSpecifier)) {
              deletableCatalogs.push({
                catalogName: pkg.name.replace('pnpm-catalog:', ''),
                name: dep.name,
                specifier: dep.specifier,
              })
            }
          }
        }

        if (!deletableCatalogs.length) {
          p.outro(c.yellow('No deletable catalog found'))
          return
        }

        p.note(
          c.reset(deletableCatalogs.map((item) => {
            return `${c.yellow(item.catalogName)}: ${c.cyan(item.name)} (${c.green(item.specifier)})`
          }).join('\n')),
          `📦 Found ${deletableCatalogs.length} deletable catalogs:`,
        )

        if (!options.yes) {
          const result = await p.confirm({
            message: c.green('Do you want to continue?'),
          })
          if (!result || p.isCancel(result)) {
            p.outro(c.red('aborting'))
            process.exit(1)
          }
        }

        const { context } = await ensurePnpmWorkspaceYAML()
        const document = context.getDocument()

        deletableCatalogs.forEach((catalog) => {
          if (catalog.catalogName === 'default')
            safeYAMLDeleteIn(document, ['catalog', catalog.name])
          safeYAMLDeleteIn(document, ['catalogs', catalog.catalogName, catalog.name])
        })

        cleanupCatalogs(context)
        p.log.info('writing pnpm-workspace.yaml')
        await writeFile(pnpmWorkspaceYamlPath, context.toString(), 'utf-8')

        p.log.success('clean complete')

        if (options.install) {
          p.outro('running pnpm install')
          await execa('pnpm', ['install'], {
            stdio: 'inherit',
            cwd: options.cwd || process.cwd(),
          })
        }
      },
    },
  )
}
