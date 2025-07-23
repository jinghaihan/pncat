import type { PackageJson } from 'pkg-types'
import type { CatalogOptions, DepType, PackageMeta, PnpmWorkspaceMeta } from '../types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { writePackageJSON } from 'pkg-types'
import { Scanner } from '../api/scanner'
import { DEPS_FIELDS } from '../constants'
import { ensurePnpmWorkspaceYAML } from '../utils/ensure'
import { getDepCatalogName } from '../utils/rule'
import { highlightYAML, safeYAMLDeleteIn } from '../utils/yaml'

export async function migrateCommand(options: CatalogOptions) {
  let pnpmWorkspacePackages: PnpmWorkspaceMeta[] = []
  const resolvedCatalogs: Record<string, Record<string, string>> = {}
  const resolvedPackageJson: Record<string, PackageJson> = {}

  function getCatalog(depName: string) {
    const target = Object.entries(resolvedCatalogs).find(([, deps]) => deps[depName])
    if (target) {
      const [name, deps] = target
      return {
        name,
        specifier: deps[depName],
      }
    }

    const pnpmWorkspace = pnpmWorkspacePackages.find(ws => ws.deps.some(dep => dep.name === depName))
    if (!pnpmWorkspace)
      return

    const dep = pnpmWorkspace.deps.find(dep => dep.name === depName)
    if (!dep)
      return

    const catalogName = options.force
      ? getDepCatalogName(dep, options)
      : pnpmWorkspace.name.replace('pnpm-catalog:', '')

    return {
      name: catalogName,
      specifier: dep.specifier,
    }
  }

  function traversePkgs(pkgs: PackageMeta[], source: DepType) {
    for (const pkg of pkgs) {
      if (pkg.type === 'pnpm-workspace.yaml')
        continue

      for (const dep of pkg.deps) {
        if (dep.source !== source)
          continue

        if (!dep.catalog)
          continue

        if (options.allowedProtocols.some(p => dep.specifier.startsWith(p)))
          continue

        const catalog = getCatalog(dep.name)
        let catalogName: string | null = null
        if (catalog) {
          catalogName = catalog.name === 'default'
            ? getDepCatalogName(dep, options)
            : catalog.name
          resolvedCatalogs[catalogName] ??= {}
          resolvedCatalogs[catalogName][dep.name] = catalog.specifier
        }
        else {
          catalogName = getDepCatalogName(dep, options)
          resolvedCatalogs[catalogName] ??= {}
          resolvedCatalogs[catalogName][dep.name] = dep.specifier
        }
      }
    }
  }

  await Scanner(
    options,
    {
      afterPackagesLoaded: (pkgs) => {
        pnpmWorkspacePackages = pkgs.filter(pkg => pkg.type === 'pnpm-workspace.yaml')
        DEPS_FIELDS.forEach((source) => {
          traversePkgs(pkgs, source)
        })
      },
      onPackageResolved: async (pkg) => {
        if (pkg.type === 'pnpm-workspace.yaml')
          return

        const content = pkg.raw
        for (const dep of pkg.deps) {
          if (!dep.catalog)
            continue

          if (options.allowedProtocols.some(p => dep.specifier.startsWith(p)))
            continue

          const catalog = getCatalog(dep.name)
          if (!catalog)
            continue

          content[dep.source][dep.name] = `catalog:${catalog.name}`
        }
        resolvedPackageJson[pkg.filepath] = content
      },
      afterPackagesEnd: async (_pkgs) => {
        const { context, pnpmWorkspaceYamlPath } = await ensurePnpmWorkspaceYAML()
        const document = context.getDocument()

        safeYAMLDeleteIn(document, ['catalog'])
        safeYAMLDeleteIn(document, ['catalogs'])

        Object.entries(resolvedCatalogs)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .forEach(([catalogName, deps]) => {
            Object.entries(deps).forEach(([depName, specifier]) => {
              if (catalogName === 'default') {
                context.setPath(['catalog', depName], specifier)
                return
              }
              context.setPath(['catalogs', catalogName, depName], specifier)
            })
          })

        const content = context.toString()
        p.note(c.reset(highlightYAML(content)), `${c.cyan('pnpm-workspace.yaml')} (${c.dim(pnpmWorkspaceYamlPath)})`)

        if (!options.yes) {
          const result = await p.confirm({
            message: c.green('looks good?'),
          })
          if (!result || p.isCancel(result)) {
            p.outro(c.red('aborting'))
            process.exit(1)
          }
        }

        p.log.info('writing pnpm-workspace.yaml')
        await writeFile(pnpmWorkspaceYamlPath, content, 'utf-8')
        p.log.info('writing package.json')
        await Promise.all(Object.entries(resolvedPackageJson).map(([filepath, content]) => {
          return writePackageJSON(filepath, content)
        }))

        p.log.success('migrate complete')
        p.outro('running pnpm install')

        await execa('pnpm', ['install'], {
          stdio: 'inherit',
          cwd: options.cwd || process.cwd(),
        })
      },
    },
  )
}
