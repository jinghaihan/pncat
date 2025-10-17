import type { PackageMeta } from '../types'

export function containsESLint(packages: PackageMeta[]): boolean {
  for (const pkg of packages) {
    if (pkg.type === 'package.json') {
      if (pkg.deps.find(i => i.name === 'eslint'))
        return true
    }
  }
  return false
}

export function containsVSCodeExtension(packages: PackageMeta[]): boolean {
  for (const pkg of packages) {
    if (pkg.type === 'package.json') {
      const { vscode } = pkg.raw.engines ?? {}
      if (vscode)
        return true
    }
  }
  return false
}
