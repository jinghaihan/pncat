import type { CatalogHandler } from '../types'
import type { Workspace } from '../workspace-manager'
import { BunCatalog } from './bun-workspace'
import { JsonCatalog } from './json-workspace'
import { PnpmCatalog } from './pnpm-workspace'
import { YamlCatalog } from './yaml-workspace'

export function createCatalogHandler(workspace: Workspace): CatalogHandler {
  const { packageManager = 'pnpm' } = workspace.getOptions()
  switch (packageManager) {
    case 'pnpm':
      return new PnpmCatalog(workspace)
    case 'yarn':
      return new YamlCatalog(workspace)
    case 'bun':
      return new BunCatalog(workspace)
    case 'vlt':
      return new JsonCatalog(workspace)
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`)
  }
}
