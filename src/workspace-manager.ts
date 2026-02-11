import type {
  CatalogHandler,
  CatalogOptions,
  PackageJsonMeta,
  PackageMeta,
  RawDep,
  WorkspacePackageMeta,
} from './types'
import { createCatalogHandler } from './catalog-handler'
import { loadPackages } from './io'
import {
  createDepCatalogIndex,
  getCwd,
  hasEslint,
  hasVSCodeEngine,
  isCatalogSpecifier,
  parseCatalogSpecifier,
  toCatalogSpecifier,
} from './utils'

export class WorkspaceManager {
  public readonly catalog: CatalogHandler
  private readonly options: CatalogOptions

  private loaded = false
  private loadTask: Promise<PackageMeta[]> | null = null
  private packages: PackageMeta[] = []
  private depNames = new Set<string>()

  constructor(options: CatalogOptions) {
    this.options = options
    this.catalog = createCatalogHandler(this.options)
  }

  getOptions(): CatalogOptions {
    return this.options
  }

  getCwd(): string {
    return getCwd(this.options)
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

  getDepNames(): string[] {
    return Array.from(this.depNames)
  }

  hasEslint(): boolean {
    return hasEslint(this.packages)
  }

  hasVSCodeEngine(): boolean {
    return hasVSCodeEngine(this.packages)
  }

  async loadPackages(): Promise<PackageMeta[]> {
    if (this.loaded)
      return this.packages

    if (!this.loadTask) {
      this.loadTask = loadPackages(this.options).then((packages) => {
        this.packages = packages
        this.buildIndexes()
        this.loaded = true
        this.loadTask = null
        return packages
      })
    }

    return await this.loadTask
  }

  async getCatalogIndex(): Promise<Map<string, { catalogName: string, specifier: string }[]>> {
    return createDepCatalogIndex(await this.catalog.toJSON())
  }

  resolveCatalogDependency(
    dep: RawDep,
    catalogIndex: Map<string, { catalogName: string, specifier: string }[]>,
    force: boolean = !!this.options.force,
  ): RawDep {
    let catalogName = dep.catalogName
    let specifier = dep.specifier
    const existingCatalogDeps = catalogIndex.get(dep.name) || []

    if (isCatalogSpecifier(dep.specifier)) {
      if (existingCatalogDeps.length === 0)
        throw new Error(`Unable to resolve catalog specifier for ${dep.name}`)

      const specifierCatalogName = parseCatalogSpecifier(dep.specifier)
      const matched = existingCatalogDeps.find(item => item.catalogName === specifierCatalogName) || existingCatalogDeps[0]

      specifier = matched.specifier
      if (!force)
        catalogName = matched.catalogName
    }
    else if (!force && existingCatalogDeps.length > 0) {
      const matched = existingCatalogDeps.find(item => item.catalogName === catalogName) || existingCatalogDeps[0]
      catalogName = matched.catalogName
      specifier = matched.specifier
    }

    return {
      ...dep,
      catalogName,
      specifier,
      update: dep.specifier !== toCatalogSpecifier(catalogName),
    }
  }

  reset(): void {
    this.loaded = false
    this.loadTask = null
    this.packages = []
    this.depNames.clear()
  }

  private buildIndexes(): void {
    this.depNames.clear()

    for (const pkg of this.getProjectPackages()) {
      for (const dep of pkg.deps)
        this.depNames.add(dep.name)
    }
  }
}
