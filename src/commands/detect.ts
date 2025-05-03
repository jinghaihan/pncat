import type { CatalogOptions, RawDep } from '../types'
import * as p from '@clack/prompts'
import c from 'ansis'
import { Scanner } from '../api/scanner'

interface CatalogableDep extends RawDep {
  packageName: string
  relativePath: string
}

export async function detectCommand(options: CatalogOptions) {
  const catalogableDeps: CatalogableDep[] = []

  await Scanner(
    options,
    {
      onPackageResolved: async (pkg) => {
        if (pkg.type === 'pnpm-workspace.yaml')
          return

        for (const dep of pkg.deps) {
          if (!dep.catalog)
            continue

          if (options.allowedProtocols.some(p => dep.specifier.startsWith(p)))
            continue

          if (dep.specifier.startsWith('catalog:'))
            continue

          catalogableDeps.push({
            ...dep,
            packageName: pkg.name,
            relativePath: pkg.relative,
          })
        }
      },
      afterPackagesEnd: () => {
        const catalogableDepsRecord = catalogableDeps.reduce((acc, dep) => {
          if (!acc[dep.name])
            acc[dep.name] = []
          acc[dep.name].push(dep)
          return acc
        }, {} as Record<string, CatalogableDep[]>)

        if (!catalogableDeps.length) {
          p.outro(c.yellow('No catalogable dependencies found'))
          return
        }

        const contents: string[] = []
        Object.keys(catalogableDepsRecord).sort().forEach((name) => {
          catalogableDepsRecord[name].sort((a, b) => a.packageName.localeCompare(b.packageName))
        })
        for (const [name, deps] of Object.entries(catalogableDepsRecord)) {
          contents.push(c.cyan(`${name} (${deps.length}):`))
          for (const dep of deps) {
            contents.push(`  ${c.yellow(dep.packageName)} (${c.dim(dep.relativePath)}): ${c.green(dep.specifier)}`)
          }
        }
        p.note(c.reset(contents.join('\n')), `📦 Found ${catalogableDeps.length} catalogable dependencies:`)
        p.outro('detect complete')
      },
    },
  )
}
