import type { PackageJson } from '../types'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'pathe'
import { readJsonFile } from './json'

export async function findNearestBunWorkspaceFile(startDir: string): Promise<string | undefined> {
  let current = resolve(startDir)

  while (true) {
    const candidate = join(current, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = await readJsonFile<PackageJson>(candidate)
        const workspaces = pkg.workspaces
        if (workspaces && !Array.isArray(workspaces) && (workspaces.catalog || workspaces.catalogs))
          return candidate
      }
      catch {
        // ignore invalid package.json and continue to parent directory
      }
    }

    const parent = dirname(current)
    if (parent === current)
      return undefined

    current = parent
  }
}
