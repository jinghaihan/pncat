import type { CatalogOptions } from './types'

export * from './pnpm-catalog-manager'
export { DEFAULT_CATALOG_RULES } from './rules'
export * from './types'
export * from './utils/catalog'
export * from './utils/merge'

export function defineConfig(config: Partial<CatalogOptions>) {
  return config
}
