import type { CatalogOptions } from '../types'
import { YamlCatalog } from './base/yaml-workspace'

export class PnpmCatalog extends YamlCatalog {
  constructor(options: CatalogOptions) {
    super(options, 'pnpm')
  }

  async updateWorkspaceOverrides(): Promise<void> {
    // Reserved for override synchronization in workspace manager phase.
  }
}
