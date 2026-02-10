import type { CatalogOptions } from '../types'
import { JsonCatalog } from './base/json-workspace'

export class VltCatalog extends JsonCatalog {
  constructor(options: CatalogOptions) {
    super(options, 'vlt')
  }
}
