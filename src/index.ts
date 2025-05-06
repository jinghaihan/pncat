import type { CatalogOptions } from './types'

export { DEFAULT_CATALOG_RULES } from './rules'
export * from './types'
export * from './utils/merge'

export function defineConfig(config: Partial<CatalogOptions>) {
  return config
}
