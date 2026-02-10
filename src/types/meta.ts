import type { DepType } from './core'
import type { PackageJson } from './package-json'

export interface WorkspaceSchema {
  catalog?: Record<string, string>
  catalogs?: Record<string, Record<string, string>>
  overrides?: Record<string, string>
  [key: string]: any
}

export interface RawDep {
  name: string
  specifier: string
  source: DepType
  parents?: string[]
  catalog: boolean
  catalogable: boolean
  catalogName: string
  update?: boolean
}

export interface BasePackageMeta {
  name: string
  private?: boolean
  version?: string
  filepath: string
  relative: string
  deps: RawDep[]
}

export interface PackageJsonMeta extends BasePackageMeta {
  type: 'package.json'
  raw: PackageJson
}

export interface PnpmWorkspaceMeta extends BasePackageMeta {
  type: 'pnpm-workspace.yaml'
  raw: WorkspaceSchema
  context: unknown
}

export interface YarnWorkspaceMeta extends Omit<PnpmWorkspaceMeta, 'type'> {
  type: '.yarnrc.yml'
}

export interface BunWorkspaceMeta extends BasePackageMeta {
  type: 'bun-workspace'
  raw: PackageJson
}

export interface VltWorkspaceMeta extends BasePackageMeta {
  type: 'vlt.json'
  raw: WorkspaceSchema
}

export type WorkspacePackageMeta = PnpmWorkspaceMeta | YarnWorkspaceMeta | BunWorkspaceMeta | VltWorkspaceMeta

export type PackageMeta = PackageJsonMeta | WorkspacePackageMeta

export interface ParsedSpec {
  name: string
  specifier?: string
  catalogName?: string
  specifierSource?: 'user' | 'catalog' | 'workspace' | 'npm'
}

export interface AgentConfig {
  type: WorkspacePackageMeta['type']
  depType: DepType
  filename: string
  locks: string[]
  defaultContent: string
}
