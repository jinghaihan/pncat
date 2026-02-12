import type {
  CatalogHandler,
  CatalogIndex,
  CatalogOptions,
  PackageJsonMeta,
  PackageMeta,
  RawDep,
  WorkspacePackageMeta,
} from './types'
import { join, resolve } from 'pathe'
import { createCatalogHandler } from './catalog-handler'
import { loadPackages } from './io'
import {
  cloneDeep,
  createDepCatalogIndex,
  ensurePackageJsonDeps,
  ensurePnpmOverrides,
  getCwd,
  getPackageJsonDeps,
  hasEslint,
  hasVSCodeEngine,
  isCatalogSpecifier,
  isPackageJsonDepSource,
  isPnpmOverridesPackageName,
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

  listProjectPackages(): PackageJsonMeta[] {
    return this.packages.filter(pkg => pkg.type === 'package.json')
  }

  listWorkspacePackages(): WorkspacePackageMeta[] {
    return this.packages.filter(pkg => pkg.type !== 'package.json')
  }

  getDepNames(): string[] {
    return Array.from(this.depNames)
  }

  resolveTargetProjectPackagePath(invocationCwd: string): string {
    const workspacePackagePath = join(this.getCwd(), 'package.json')
    const invocationPackagePath = join(resolve(invocationCwd), 'package.json')

    if (this.listProjectPackages().some(pkg => pkg.filepath === invocationPackagePath))
      return invocationPackagePath

    return workspacePackagePath
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

  async getCatalogIndex(): Promise<CatalogIndex> {
    return createDepCatalogIndex(await this.catalog.toJSON())
  }

  resolveCatalogDep(
    dep: RawDep,
    catalogIndex: CatalogIndex,
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

  isCatalogDepReferenced(
    depName: string,
    catalogName: string,
    packages: PackageJsonMeta[] = this.listProjectPackages(),
  ): boolean {
    const expectedSpecifier = toCatalogSpecifier(catalogName)

    for (const pkg of packages) {
      for (const dep of pkg.deps) {
        if (dep.name !== depName)
          continue

        if (dep.source === 'pnpm.overrides') {
          if (dep.specifier === expectedSpecifier)
            return true
          continue
        }

        if (!isCatalogSpecifier(dep.specifier))
          continue

        if (parseCatalogSpecifier(dep.specifier) === catalogName)
          return true
      }
    }

    return false
  }

  setDepSpecifier(
    updatedPackages: Map<string, PackageJsonMeta>,
    pkg: PackageJsonMeta,
    dep: RawDep,
    specifier: string,
  ): void {
    const updatedPackage = this.ensureUpdatedPackage(updatedPackages, pkg)

    if (dep.source === 'pnpm.overrides') {
      ensurePnpmOverrides(updatedPackage.raw)[dep.name] = specifier
      return
    }

    if (!isPackageJsonDepSource(dep.source))
      return

    ensurePackageJsonDeps(updatedPackage.raw, dep.source)[dep.name] = specifier
  }

  removeCatalogDepFromPackages(
    updatedPackages: Map<string, PackageJsonMeta>,
    packages: PackageJsonMeta[],
    depName: string,
    catalogName: string,
  ): boolean {
    let removed = false

    for (const pkg of packages) {
      for (const dep of pkg.deps) {
        if (dep.name !== depName)
          continue
        if (!isCatalogSpecifier(dep.specifier))
          continue
        if (parseCatalogSpecifier(dep.specifier) !== catalogName)
          continue

        const updatedPackage = this.ensureUpdatedPackage(updatedPackages, pkg)
        if (dep.source === 'pnpm.overrides') {
          delete ensurePnpmOverrides(updatedPackage.raw)[dep.name]
          removed = true
          continue
        }

        if (isPnpmOverridesPackageName(pkg.name))
          continue

        if (!isPackageJsonDepSource(dep.source))
          continue

        delete getPackageJsonDeps(updatedPackage.raw, dep.source)?.[dep.name]
        removed = true
      }
    }

    return removed
  }

  hasEslint(): boolean {
    return hasEslint(this.packages)
  }

  hasVSCodeEngine(): boolean {
    return hasVSCodeEngine(this.packages)
  }

  reset(): void {
    this.loaded = false
    this.loadTask = null
    this.packages = []
    this.depNames.clear()
  }

  private ensureUpdatedPackage(
    updatedPackages: Map<string, PackageJsonMeta>,
    pkg: PackageJsonMeta,
  ): PackageJsonMeta {
    if (!updatedPackages.has(pkg.name))
      updatedPackages.set(pkg.name, cloneDeep(pkg))

    return updatedPackages.get(pkg.name)!
  }

  private buildIndexes(): void {
    this.depNames.clear()

    for (const pkg of this.listProjectPackages()) {
      for (const dep of pkg.deps)
        this.depNames.add(dep.name)
    }
  }
}
