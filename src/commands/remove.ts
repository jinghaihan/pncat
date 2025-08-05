import type { CatalogOptions, PnpmWorkspaceMeta } from '../types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { writePackageJSON } from 'pkg-types'
import { Scanner } from '../api/scanner'
import { ensurePnpmWorkspaceYAML } from '../utils/ensure'
import { findWorkspaceYaml } from '../utils/workspace'
import { cleanupCatalogs, safeYAMLDeleteIn } from '../utils/yaml'

interface OptionalCatalog {
  name: string
  catalogName: string
  specifier: string
}

export async function removeCommand(options: CatalogOptions) {
  const names: string[] = process.argv.slice(3)
  const optionalCatalogs: Record<string, OptionalCatalog[]> = {}

  if (!names.length) {
    p.outro(c.red('no package name provided, aborting'))
    process.exit(1)
  }

  const pnpmWorkspaceYamlPath = await findWorkspaceYaml()
  if (!pnpmWorkspaceYamlPath) {
    p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
    process.exit(1)
  }

  const { context } = await ensurePnpmWorkspaceYAML()
  const document = context.getDocument()

  async function resolveCatalogSelect(name: string, catalog: OptionalCatalog) {
    p.log.info(`${c.cyan(name)} found in ${c.yellow(catalog.catalogName)}`)

    if (!options.yes) {
      const result = await p.confirm({
        message: c.green('remove from catalog and package.json?'),
      })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }

    const catalogName = catalog.catalogName.replace('pnpm-catalog:', '')
    if (catalogName === 'default')
      safeYAMLDeleteIn(document, ['catalog', catalog.name])
    else
      safeYAMLDeleteIn(document, ['catalogs', catalogName, catalog.name])

    return {
      name,
      specifier: catalogName === 'default' ? `catalog:` : `catalog:${catalogName}`,
    }
  }

  await Scanner(
    options,
    {
      afterPackagesLoaded: async (pkgs) => {
        const pnpmWorkspacePackages: PnpmWorkspaceMeta[] = pkgs.filter(pkg => pkg.type === 'pnpm-workspace.yaml')
        for (const pkg of pnpmWorkspacePackages) {
          for (const dep of pkg.deps) {
            if (names.includes(dep.name)) {
              optionalCatalogs[dep.name] ??= []
              optionalCatalogs[dep.name].push({
                name: dep.name,
                catalogName: pkg.name,
                specifier: dep.specifier,
              })
            }
          }
        }

        const pendingDeps: { name: string, specifier: string }[] = []

        await Promise.all(names.map(async (name) => {
          const catalogOptions = optionalCatalogs[name]
          if (!catalogOptions) {
            p.outro(`${c.cyan(name)} not found in pnpm-workspace.yaml, running pnpm remove ${c.cyan(name)}`)
            await execa('pnpm', ['remove', name, options.recursive ? '--recursive' : ''], {
              stdio: 'inherit',
              cwd: options.cwd || process.cwd(),
            })
            return
          }

          if (catalogOptions.length === 1) {
            pendingDeps.push(await resolveCatalogSelect(name, catalogOptions[0]))
            return
          }

          const result: string | symbol = await p.select({
            message: `${c.cyan(name)} found in multiple catalogs, please select one`,
            options: catalogOptions.map(catalog => ({
              value: catalog.catalogName,
              label: catalog.catalogName,
            })),
          })

          const selected = catalogOptions.find(catalog => catalog.catalogName === result)
          if (!selected || !result || typeof result === 'symbol') {
            p.outro(c.red('invalid catalog'))
            process.exit(1)
          }

          pendingDeps.push(await resolveCatalogSelect(name, selected))
        }))

        cleanupCatalogs(context)
        p.log.info('writing pnpm-workspace.yaml')
        await writeFile(pnpmWorkspaceYamlPath, context.toString(), 'utf-8')
        p.log.info('writing package.json')

        for (const pkg of pkgs) {
          if (pkg.type === 'pnpm-workspace.yaml')
            continue

          let changed = false
          const content = pkg.raw
          for (const dep of pkg.deps) {
            const pending = pendingDeps.find(pending => pending.name === dep.name)
            if (pending && dep.specifier === pending?.specifier) {
              delete content[dep.source][dep.name]
              changed = true
            }
          }
          if (changed) {
            await writePackageJSON(pkg.filepath, content)
          }
        }

        p.log.success('remove complete')

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
