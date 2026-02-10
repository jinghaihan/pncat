import type { CatalogHandler, CatalogOptions } from '../types'
import { BunCatalog } from './bun-workspace'
import { PnpmCatalog } from './pnpm-workspace'
import { VltCatalog } from './vlt-workspace'
import { YarnCatalog } from './yarn-workspace'

export function createCatalogHandler(options: CatalogOptions): CatalogHandler {
  const agent = options.agent || 'pnpm'

  switch (agent) {
    case 'pnpm':
      return new PnpmCatalog(options)
    case 'yarn':
      return new YarnCatalog(options)
    case 'bun':
      return new BunCatalog(options)
    case 'vlt':
      return new VltCatalog(options)
    default:
      throw new Error(`Unsupported package manager: ${agent}`)
  }
}

export { BunCatalog, PnpmCatalog, VltCatalog, YarnCatalog }
