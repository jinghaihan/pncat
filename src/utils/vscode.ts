import type { PackageMeta } from '../types'

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
