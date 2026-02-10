import type { DEPS_FIELDS, MODE_CHOICES, PACKAGE_MANAGERS } from '../constants'
import type { HookFunction } from './fn'
import type { CatalogRule, SpecifierOptions } from './rules'

export type RangeMode = (typeof MODE_CHOICES)[number]

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

export type DepType = (typeof DEPS_FIELDS)[number]

export type DepFieldOptions = Partial<Record<DepType, boolean>>

export interface CommandOptions {
  cwd?: string
  mode?: RangeMode
  recursive?: boolean
  force?: boolean
  catalog?: string
  yes?: boolean
  install?: boolean
  verbose?: boolean
}

export interface ConfigOptions {
  agent?: PackageManager
  include?: string | string[]
  exclude?: string | string[]
  ignorePaths?: string | string[]
  ignoreOtherWorkspaces?: boolean
  depFields?: DepFieldOptions
  allowedProtocols?: string[]
  saveExact?: boolean
  postRun?: string | HookFunction | Array<string | HookFunction>
}

export interface CatalogOptions extends CommandOptions, ConfigOptions {
  catalogRules?: CatalogRule[]
  specifierOptions?: SpecifierOptions
}
