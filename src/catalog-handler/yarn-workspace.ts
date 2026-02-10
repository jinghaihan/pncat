import type { CatalogOptions } from '../types'
import { YamlCatalog } from './base/yaml-workspace'

export class YarnCatalog extends YamlCatalog {
  constructor(options: CatalogOptions) {
    super(options, 'yarn')
  }
}
