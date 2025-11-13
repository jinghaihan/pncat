import type { CatalogHandler } from '../types'
import type { Workspace } from '../workspace-manager'
import { BunCatalog } from './bun-workspace'
import { PnpmCatalog } from './pnpm-workspace'
import { VltCatalog } from './vlt-workspace'
import { YarnCatalog } from './yarn-workspace'

export function createCatalogHandler(workspace: Workspace): CatalogHandler {
  const { agent = 'pnpm' } = workspace.getOptions()
  switch (agent) {
    case 'pnpm':
      return new PnpmCatalog(workspace)
    case 'yarn':
      return new YarnCatalog(workspace)
    case 'bun':
      return new BunCatalog(workspace)
    case 'vlt':
      return new VltCatalog(workspace)
    default:
      throw new Error(`Unsupported package manager: ${agent}`)
  }
}

export { BunCatalog, PnpmCatalog, VltCatalog, YarnCatalog }
