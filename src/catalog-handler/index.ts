import type { CatalogHandler, CatalogOptions } from '../types'
import { BunCatalog } from './bun-workspace'
import { PnpmCatalog } from './pnpm-workspace'
import { VltCatalog } from './vlt-workspace'
import { YarnCatalog } from './yarn-workspace'

/// keep-sorted
export const catalogHandlers = {
  bun: BunCatalog,
  pnpm: PnpmCatalog,
  vlt: VltCatalog,
  yarn: YarnCatalog,
} as const

export function createCatalogHandler(options: CatalogOptions): CatalogHandler {
  const { agent = 'pnpm' } = options

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
