import type { PackageJson } from 'pkg-types'
import type { CatalogOptions, PnpmWorkspaceMeta } from '../types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { writePackageJSON } from 'pkg-types'
import { Scanner } from '../api/scanner'
import { ensurePnpmWorkspaceYAML } from '../utils/ensure'
import { safeYAMLDeleteIn } from '../utils/yaml'

export async function revertCommand(options: CatalogOptions) {
  const catalogSpecifiedRecord: Record<string, Record<string, string>> = {}
  const resolvedPackageJson: Record<string, PackageJson> = {}

  await Scanner(
    options,
    {
      afterPackagesLoaded: (pkgs) => {
        const pnpmWorkspacePackages: PnpmWorkspaceMeta[] = pkgs.filter(pkg => pkg.type === 'pnpm-workspace.yaml')
        for (const pkg of pnpmWorkspacePackages) {
          for (const dep of pkg.deps) {
            const catalogSpecifier = pkg.name.replace('pnpm-catalog:', 'catalog:')
            catalogSpecifiedRecord[dep.name] ??= {}
            catalogSpecifiedRecord[dep.name][catalogSpecifier] = dep.specifier
          }
        }
      },
      onPackageResolved: (pkg) => {
        if (pkg.type === 'pnpm-workspace.yaml')
          return

        const content = pkg.raw
        for (const dep of pkg.deps) {
          if (!dep.specifier.includes('catalog:'))
            continue

          content[dep.source][dep.name] = catalogSpecifiedRecord[dep.name][dep.specifier]
        }
        resolvedPackageJson[pkg.filepath] = content
      },
      afterPackagesEnd: async (_pkgs) => {
        const { context, pnpmWorkspaceYamlPath } = await ensurePnpmWorkspaceYAML()
        const document = context.getDocument()

        safeYAMLDeleteIn(document, ['catalog'])
        safeYAMLDeleteIn(document, ['catalogs'])

        if (!options.yes) {
          const result = await p.confirm({
            message: c.green('All catalog dependencies will be removed from pnpm-workspace.yaml, are you sure?'),
          })
          if (!result || p.isCancel(result)) {
            p.outro(c.red('aborting'))
            process.exit(1)
          }
        }

        p.log.info('writing pnpm-workspace.yaml')
        await writeFile(pnpmWorkspaceYamlPath, context.toString(), 'utf-8')
        p.log.info('writing package.json')
        await Promise.all(Object.entries(resolvedPackageJson).map(([filepath, content]) => {
          return writePackageJSON(filepath, content)
        }))

        p.log.success('revert complete')

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
