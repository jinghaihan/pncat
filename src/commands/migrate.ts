import type { PackageJson } from 'pkg-types'
import type { CatalogOptions, DepType, PackageMeta, PnpmWorkspaceMeta } from '../types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { writePackageJSON } from 'pkg-types'
import semver from 'semver'
import { Scanner } from '../api/scanner'
import { DEPS_FIELDS } from '../constants'
import { ensurePnpmWorkspaceYAML } from '../utils/ensure'
import { cleanSpecifier, getDepCatalogName } from '../utils/rule'
import { highlightYAML, safeYAMLDeleteIn } from '../utils/yaml'

export async function migrateCommand(options: CatalogOptions) {
  let pnpmWorkspacePackages: PnpmWorkspaceMeta[] = []
  const resolvedCatalogs: Record<string, Record<string, string>> = {}
  const resolvedPackageJson: Record<string, PackageJson> = {}
  // Record conflicts: Map<depName, Set<specifier>>
  const conflictSpecifiers: Map<string, Set<string>> = new Map()
  // Record which catalog each dependency belongs to
  const depToCatalog: Map<string, string> = new Map()

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
        const catalogName = getDepCatalogName(dep, options)
        resolvedCatalogs[catalogName] ??= {}

        // Record which catalog this dependency belongs to
        depToCatalog.set(dep.name, catalogName)

        if (catalog?.name === catalogName || catalog?.name === 'default') {
          const existingSpecifier = resolvedCatalogs[catalogName][dep.name]
          if (!existingSpecifier) {
            resolvedCatalogs[catalogName][dep.name] = catalog.specifier
            continue
          }

          if (dep.specifier.startsWith('catalog:'))
            continue

          if (existingSpecifier === dep.specifier)
            continue

          // Record conflict if specifiers are different
          if (!conflictSpecifiers.has(dep.name))
            conflictSpecifiers.set(dep.name, new Set())

          conflictSpecifiers.get(dep.name)!.add(existingSpecifier)
          conflictSpecifiers.get(dep.name)!.add(dep.specifier)

          // Compare versions and use the newer one
          try {
            const existSpec = cleanSpecifier(existingSpecifier)
            const depSpec = cleanSpecifier(dep.specifier)

            if (semver.valid(existSpec) && semver.valid(depSpec)) {
              if (semver.gt(depSpec, existSpec))
                resolvedCatalogs[catalogName][dep.name] = dep.specifier
            }
            else if (semver.coerce(existSpec) && semver.coerce(depSpec)) {
              const existVer = semver.coerce(existSpec)!.version
              const depVer = semver.coerce(depSpec)!.version
              if (semver.gt(depVer, existVer))
                resolvedCatalogs[catalogName][dep.name] = dep.specifier
            }
          }
          catch {
            // If version comparison fails, keep existing
            p.log.warn(c.yellow(`${dep.name}: ${existingSpecifier} ${dep.specifier} (version comparison failed)`))
          }
        }
        else {
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
        if (!options.yes && conflictSpecifiers.size > 0) {
          p.log.warn(c.yellow(`📦 Found ${conflictSpecifiers.size} dependencies with version conflicts`))

          for (const [depName, specifiers] of conflictSpecifiers) {
            // Get catalog name from mapping
            const catalogName = depToCatalog.get(depName) || 'default'

            const specifierArray = Array.from(specifiers).sort()
            const currentSpecifier = resolvedCatalogs[catalogName][depName]

            // Create choices with better formatting
            const choices = specifierArray.map((spec) => {
              let label = spec
              if (spec === currentSpecifier) {
                label += c.green(' (auto-selected)')
              }

              return {
                label,
                value: spec,
              }
            })

            const result: string | symbol = await p.select({
              message: `${c.cyan(depName)} in catalog ${c.yellow(catalogName)}:`,
              options: choices,
              initialValue: currentSpecifier,
            })

            if (p.isCancel(result)) {
              p.outro(c.red('aborting'))
              process.exit(1)
            }

            const selected = choices.find(i => i.value === result)
            if (!selected || !result || typeof result === 'symbol') {
              p.outro(c.red('invalid specifier'))
              process.exit(1)
            }

            // Update the resolved catalog with user's choice
            resolvedCatalogs[catalogName][depName] = result
          }
        }

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
