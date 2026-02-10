import type { CatalogOptions } from './types'

export * from './catalog-handler'
export * from './constants'
export * from './io'
export * from './types'
export * from './utils'
export * from './workspace-manager'

export function defineConfig(config: Partial<CatalogOptions>) {
  return config
}
