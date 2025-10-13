import type { CatalogHandler, CatalogOptions } from '../types'
import { PnpmCatalog } from './pnpm-workspace'
import { YamlCatalog } from './yaml-workspace'

export function createCatalogHandler(options: CatalogOptions): CatalogHandler {
  const packageManager = options.packageManager ?? 'pnpm'
  switch (packageManager) {
    case 'pnpm':
      return new PnpmCatalog(options)
    case 'yarn':
      return new YamlCatalog(options)
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`)
  }
}
