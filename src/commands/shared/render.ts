import type { PackageMeta, RawDep } from '@/types'
import c from 'ansis'
import { DEPS_TYPE_SHORT_MAP } from '@/constants'

const MIN_DEP_NAME_WIDTH = 12
const MIN_DEP_TYPE_WIDTH = 6
const MIN_SPECIFIER_WIDTH = 10
const MIN_CATALOG_WIDTH = 10

export function renderChanges(deps: RawDep[], updatedPackages: Record<string, PackageMeta>): string {
  if (deps.length === 0)
    return ''

  let depNameWidth = MIN_DEP_NAME_WIDTH
  let depTypeWidth = MIN_DEP_TYPE_WIDTH
  let specifierWidth = MIN_SPECIFIER_WIDTH
  let catalogWidth = MIN_CATALOG_WIDTH

  for (const dep of deps) {
    depNameWidth = Math.max(depNameWidth, dep.name.length)
    depTypeWidth = Math.max(depTypeWidth, DEPS_TYPE_SHORT_MAP[dep.source].length)
    specifierWidth = Math.max(specifierWidth, dep.specifier.length)
    catalogWidth = Math.max(catalogWidth, dep.catalogName.length)
  }

  const packageDepsMap = new Map<string, RawDep[]>()
  for (const dep of deps) {
    for (const [pkgName, pkgMeta] of Object.entries(updatedPackages)) {
      if (!pkgMeta.deps.some(entry => entry.name === dep.name && entry.source === dep.source))
        continue

      packageDepsMap.set(pkgName, [...(packageDepsMap.get(pkgName) || []), dep])
    }
  }

  const lines: string[] = []
  for (const [pkgName, pkgMeta] of Object.entries(updatedPackages)) {
    const packageDeps = packageDepsMap.get(pkgName) || []
    if (packageDeps.length === 0)
      continue

    lines.push(`${c.cyan(pkgName)} ${c.dim(pkgMeta.relative)}`)
    lines.push('')

    for (const dep of packageDeps) {
      const depName = dep.name.padEnd(depNameWidth)
      const depType = DEPS_TYPE_SHORT_MAP[dep.source].padEnd(depTypeWidth)
      const specifier = dep.specifier.padStart(specifierWidth)
      const catalogName = (dep.catalogName === 'default' ? '' : dep.catalogName).padEnd(catalogWidth)
      lines.push(`  ${depName} ${c.dim(depType)} ${c.red(specifier)}  ${c.dim('→')}  catalog:${c.reset(c.green(catalogName))}`)
    }

    lines.push('')
  }

  const packageCount = Object.keys(updatedPackages).length
  const packageLabel = packageCount === 1 ? 'package' : 'packages'
  const depLabel = deps.length === 1 ? 'dependency' : 'dependencies'
  lines.push(`${c.yellow(packageCount)} ${packageLabel} ${c.yellow(deps.length)} ${depLabel}`)

  return lines.join('\n')
}
