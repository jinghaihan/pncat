import type { CatalogOptions } from './types'

export * from './catalog-handler'
export * from './constants'
export * from './types'

export function defineConfig(config: Partial<CatalogOptions>) {
  return config
}
