import type { CatalogHandler, CatalogOptions, PackageJsonMeta, PackageMeta, RawDep, WorkspacePackageMeta } from './types'
import process from 'node:process'
import { join } from 'pathe'
import { createCatalogHandler } from './catalog-handler'
import { loadPackages, readJSON } from './io/packages'
import { inferCatalogName } from './utils/catalog'

export class Workspace {
  public catalog: CatalogHandler

  private loaded: boolean = false
  private loadTask: Promise<PackageMeta[]> | null = null

  private options: CatalogOptions
  private packages: PackageMeta[] = []
  private packageRegistry = new Map<string, PackageJsonMeta>()
  private catalogRegistry = new Map<string, WorkspacePackageMeta>()

  private packageDepIndex = new Map<string, Map<string, RawDep>>()
  private catalogDepIndex = new Map<string, Map<string, RawDep>>()
  private depUsageIndex = new Map<string, Set<string>>()

  constructor(options: CatalogOptions) {
    this.options = options
    this.catalog = createCatalogHandler(this)
  }

  /**
   * Reset the catalog manager, clear all indexes and loaded packages
   */
  reset() {
    this.loaded = false
    this.loadTask = null
    this.packages = []
    this.packageRegistry.clear()
    this.catalogRegistry.clear()
    this.packageDepIndex.clear()
    this.catalogDepIndex.clear()
    this.depUsageIndex.clear()
  }

  /**
   * Get the catalog options
   */
  getOptions() {
    return this.options
  }

  /**
   * Get the current working directory
   */
  getCwd() {
    return this.options.cwd || process.cwd()
  }

  /**
   * Load packages from the current working directory
   */
  async loadPackages(): Promise<PackageMeta[]> {
    if (this.loaded)
      return this.packages
    if (!this.loadTask) {
      this.loadTask = loadPackages(this.options).then((packages) => {
        this.packages = packages

        this.createIndexes()

        this.loaded = true
        this.loadTask = null
        return packages
      })
    }
    return await this.loadTask
  }

  /**
   * Get the names of monorepo packages
   */
  getWorkspacePackages(): string[] {
    return Array.from(this.packageRegistry.keys())
  }

  /**
   * Get the dependencies of a package
   */
  getPackageDeps(pkgName: string): RawDep[] {
    return Array.from(this.packageDepIndex.get(pkgName)?.values() ?? [])
  }

  /**
   * Get a dependency of a package
   */
  getPackageDep(depName: string, pkgName: string): RawDep | null {
    return this.packageDepIndex.get(pkgName)?.get(depName) ?? null
  }

  /**
   * Remove a dependency from a package
   */
  async removePackageDep(
    depName: string,
    catalogName: string,
    isRecursive: boolean = true,
    updatedPackages?: Map<string, PackageJsonMeta>,
  ): Promise<{
    updatedPackages: Map<string, PackageJsonMeta>
    catalogDeletable: boolean
  }> {
    let catalogDeletable = true
    updatedPackages ??= new Map()

    const packages = this.getDepPackages(depName).filter(i => !this.isCatalogPackageName(i) && !this.isPnpmOverridesPackageName(i))
    if (packages.length === 0)
      return { updatedPackages, catalogDeletable }

    const removeDep = (pkgName: string) => {
      const pkg = this.packageRegistry.get(pkgName)
      if (!pkg)
        return

      const dep = pkg.deps.find(i => i.name === depName && this.extractCatalogName(i.specifier) === catalogName)
      if (!dep)
        return

      if (!updatedPackages.has(pkgName))
        updatedPackages.set(pkgName, structuredClone(pkg))
      const updatedPkg = updatedPackages.get(pkgName)!

      delete updatedPkg.raw[dep.source][dep.name]
    }

    if (isRecursive || packages.length === 1) {
      for (const pkgName of packages) {
        removeDep(pkgName)
      }
    }
    else {
      const pkgPath = join(process.cwd(), 'package.json')
      const { name } = await readJSON(pkgPath)
      if (!name)
        return { updatedPackages, catalogDeletable }

      // if the package is not the only one, the catalog is not deletable
      const filtered = packages.filter(i => i !== name)
      if (filtered.length)
        catalogDeletable = false

      removeDep(name)
    }

    return { updatedPackages, catalogDeletable }
  }

  /**
   * Get the dependencies of a catalog
   */
  getCatalogDeps(catalogName: string): RawDep[] {
    return Array.from(this.catalogDepIndex.get(catalogName)?.values() ?? [])
  }

  /**
   * Get a dependency of a catalog
   */
  getCatalogDep(depName: string, catalogName: string): RawDep | null {
    return this.catalogDepIndex.get(depName)?.get(catalogName) ?? null
  }

  /**
   * Get the packages that use a dependency
   */
  getDepPackages(depName: string): string[] {
    return Array.from(this.depUsageIndex.get(depName) ?? [])
  }

  /**
   * Infer the catalog name for a dependency
   */
  inferCatalogName(dep: Omit<RawDep, 'catalogName'>): string {
    return inferCatalogName(dep, this.options)
  }

  /**
   * Check if a specifier is a catalog specifier
   */
  isCatalogSpecifier(specifier: string): boolean {
    return specifier.startsWith('catalog:')
  }

  /**
   * Extract the catalog name from a specifier
   */
  extractCatalogName(specifier: string): string {
    if (this.isCatalogSpecifier(specifier))
      return specifier.replace('catalog:', '')

    return ''
  }

  /**
   * Check if a specifier is a catalog package name
   */
  isCatalogPackageName(pkgName: string): boolean {
    return pkgName.startsWith('pnpm-catalog:') || pkgName.startsWith('yarn-catalog:') || pkgName.startsWith('bun-catalog:')
  }

  isPnpmOverridesPackageName(pkgName: string): boolean {
    return pkgName === 'pnpm-workspace:overrides'
  }

  /**
   * Extract the catalog name from a package name
   */
  extractCatalogNameFromPackageName(pkgName: string): string {
    if (this.isCatalogPackageName(pkgName)) {
      return pkgName
        .replace('pnpm-catalog:', '')
        .replace('yarn-catalog:', '')
        .replace('bun-catalog:', '')
    }

    return ''
  }

  /**
   * Resolve a dependency, update the catalog name if needed
   */
  resolveDep(dep: RawDep, force?: boolean): RawDep {
    if (!dep.catalog)
      return { ...dep, update: true }

    const catalogDep = this.resolveCatalogDep(dep)
    if (!catalogDep)
      return { ...dep, update: true }

    if (dep.catalogName === catalogDep.catalogName)
      return catalogDep

    const update = force ?? this.options.force
    return {
      ...catalogDep,
      catalogName: update ? dep.catalogName : catalogDep.catalogName,
      update,
    }
  }

  /**
   * Resolve a catalog dependency, get the specifier from the catalog
   */
  resolveCatalogDep(dep: RawDep): RawDep | null {
    const pkgs = this.catalogDepIndex.get(dep.name)
    if (!pkgs)
      return null

    // pnpm catalog
    const pnpmPkgName = `pnpm-catalog:${dep.catalogName}`
    if (pkgs.has(pnpmPkgName)) {
      const catalogDep = pkgs.get(pnpmPkgName)!
      return { ...dep, specifier: catalogDep.specifier }
    }

    // yarn catalog
    const yarnPkgName = `yarn-catalog:${dep.catalogName}`
    if (pkgs.has(yarnPkgName)) {
      const catalogDep = pkgs.get(yarnPkgName)!
      return { ...dep, specifier: catalogDep.specifier }
    }

    // bun catalog
    const bunPkgName = `bun-catalog:${dep.catalogName}`
    if (pkgs.has(bunPkgName)) {
      const catalogDep = pkgs.get(bunPkgName)!
      return { ...dep, specifier: catalogDep.specifier }
    }

    const catalogDep = Array.from(pkgs.values())[0]
    const catalogName = this.extractCatalogNameFromPackageName(Array.from(pkgs.keys())[0])

    return { ...dep, specifier: catalogDep.specifier, catalogName }
  }

  /**
   * Check if a catalog dependency is in a package
   */
  isDepInPackage(catalogDep: RawDep): boolean {
    if (!this.packageDepIndex.has(catalogDep.name))
      return false

    const deps = Array.from(this.packageDepIndex.get(catalogDep.name)?.values() ?? [])
    return !!deps.find(i => i.catalogName === catalogDep.catalogName)
  }

  /**
   * Check if a catalog dependency is in pnpm overrides
   */
  isDepInPnpmOverrides(catalogDep: RawDep): boolean {
    const pkg = this.packages.find(i => i.name === 'pnpm-workspace:overrides')
    if (!pkg || !pkg.raw.overrides)
      return false
    return !!pkg.raw.overrides[catalogDep.name]
  }

  /**
   * Check if a package dependency is in a catalog
   */
  isDepInCatalog(pkgDep: RawDep): boolean {
    if (!pkgDep.catalog)
      return false

    if (!this.catalogDepIndex.has(pkgDep.name))
      return false

    const catalogName = this.extractCatalogName(pkgDep.specifier)
    const deps = Array.from(this.catalogDepIndex.get(pkgDep.name)?.values() ?? [])
    return !!deps.find(i => i.catalogName === catalogName)
  }

  /**
   * Get the names of dependencies
   */
  getDepNames(): string[] {
    return Array.from(this.depUsageIndex.keys())
  }

  /**
   * Create indexes for the loaded packages
   */
  private createIndexes() {
    for (const pkg of this.packages) {
      for (const pkgDep of pkg.deps) {
        if (pkg.type === 'package.json') {
          this.packageRegistry.set(pkg.name, pkg)
          this.setPackageDepIndex(pkg, pkgDep)
        }

        if (this.isCatalogPackage(pkg)) {
          this.catalogRegistry.set(pkg.name, pkg)
          this.setCatalogDepIndex(pkg, pkgDep)
        }

        this.setDepUsageIndex(pkg, pkgDep)
      }
    }
  }

  /**
   * Set the package dependency index
   */
  private setPackageDepIndex(pkg: PackageJsonMeta, dep: RawDep) {
    if (!this.packageDepIndex.has(dep.name))
      this.packageDepIndex.set(dep.name, new Map())
    this.packageDepIndex.get(dep.name)!.set(pkg.name, dep)
  }

  /**
   * Set the workspace dependency index
   */
  private setCatalogDepIndex(pkg: WorkspacePackageMeta, dep: RawDep) {
    if (!this.catalogDepIndex.has(dep.name))
      this.catalogDepIndex.set(dep.name, new Map())
    this.catalogDepIndex.get(dep.name)!.set(pkg.name, dep)
  }

  /**
   * Set the dependency usage index
   */
  private setDepUsageIndex(pkg: PackageMeta, pkgDep: RawDep) {
    if (!this.depUsageIndex.has(pkgDep.name))
      this.depUsageIndex.set(pkgDep.name, new Set())
    this.depUsageIndex.get(pkgDep.name)!.add(pkg.name)
  }

  isCatalogPackage(pkg: PackageMeta): pkg is WorkspacePackageMeta {
    return pkg.type === 'pnpm-workspace.yaml' || pkg.type === '.yarnrc.yml' || pkg.type === 'bun-workspace'
  }
}
