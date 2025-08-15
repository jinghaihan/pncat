import type { PackageJsonMeta, RawDep } from '../types'
import c from 'ansis'
import { DEPENDENCIES_TYPE_SHORT_MAP } from '../constants'

const MIN_DEP_NAME_WIDTH = 12
const MIN_DEP_TYPE_WIDTH = 6
const MIN_SPECIFIER_WIDTH = 10
const MIN_CATALOG_WIDTH = 10

export function renderChanges(deps: RawDep[], updatedPackages: Record<string, PackageJsonMeta>): string {
  if (!deps.length) {
    return ''
  }

  // Calculate dynamic column widths based on content
  let maxDepNameWidth = MIN_DEP_NAME_WIDTH
  let maxDepTypeWidth = MIN_DEP_TYPE_WIDTH
  let maxSpecifierWidth = MIN_SPECIFIER_WIDTH
  let maxCatalogWidth = MIN_CATALOG_WIDTH

  for (const dep of deps) {
    maxDepNameWidth = Math.max(maxDepNameWidth, dep.name.length)
    maxDepTypeWidth = Math.max(maxDepTypeWidth, DEPENDENCIES_TYPE_SHORT_MAP[dep.source].length)
    maxSpecifierWidth = Math.max(maxSpecifierWidth, (dep.specifier || '').length)
    maxCatalogWidth = Math.max(maxCatalogWidth, dep.catalogName.length)
  }

  const depsByPackage = new Map<string, RawDep[]>()
  for (const dep of deps) {
    for (const [pkgName, pkgMeta] of Object.entries(updatedPackages)) {
      if (pkgMeta.deps.some(d => d.name === dep.name && d.source === dep.source)) {
        if (!depsByPackage.has(pkgName)) {
          depsByPackage.set(pkgName, [])
        }
        depsByPackage.get(pkgName)!.push(dep)
        break
      }
    }
  }

  const lines: string[] = []
  for (const [pkgName, pkgMeta] of Object.entries(updatedPackages)) {
    const pkgDeps = depsByPackage.get(pkgName) || []
    if (pkgDeps.length === 0)
      continue

    lines.push(`${c.cyan(pkgName)} ${c.dim(pkgMeta.relative)}`)
    lines.push('')

    for (const dep of pkgDeps) {
      const depName = dep.name.padEnd(maxDepNameWidth)
      const depType = DEPENDENCIES_TYPE_SHORT_MAP[dep.source].padEnd(maxDepTypeWidth)
      const depSpecifier = (dep.specifier || '').padStart(maxSpecifierWidth)
      const catalogName = dep.catalogName.padEnd(maxCatalogWidth)
      lines.push(`  ${depName} ${c.dim(depType)} ${c.red(depSpecifier)}  ${c.dim('→')}  catalog:${c.reset(c.green(`${catalogName}`))}`)
    }
    lines.push('')
  }

  const pkgCount = Object.keys(updatedPackages).length
  lines.push(`${c.yellow(pkgCount)} package${pkgCount > 1 ? 's' : ''} ${c.yellow(deps.length)} dependenc${deps.length > 1 ? 'ies' : 'y'}`)

  return lines.join('\n')
}
