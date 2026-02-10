import type {
  CatalogHandler,
  CatalogOptions,
  PackageJsonMeta,
  PackageMeta,
  WorkspacePackageMeta,
} from './types'
import { createCatalogHandler } from './catalog-handler'
import { loadPackages } from './io'

export class WorkspaceManager {
  public readonly catalog: CatalogHandler
  private readonly options: CatalogOptions

  private packages: PackageMeta[] = []

  constructor(options: CatalogOptions) {
    this.options = options
    this.catalog = createCatalogHandler(this.options)
  }

  getPackages(): PackageMeta[] {
    return this.packages
  }

  getProjectPackages(): PackageJsonMeta[] {
    return this.packages.filter(pkg => pkg.type === 'package.json')
  }

  getWorkspacePackages(): WorkspacePackageMeta[] {
    return this.packages.filter(pkg => pkg.type !== 'package.json')
  }

  async loadPackages(): Promise<PackageMeta[]> {
    this.packages = await loadPackages(this.options)
    return this.packages
  }

  reset(): void {
    this.packages = []
  }
}
