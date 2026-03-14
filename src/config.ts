import type { CatalogOptions, CommandOptions, DepFieldOptions, DepType } from './types'
import deepmerge from 'deepmerge'
import { createConfigLoader } from 'unconfig'
import { CLI_DEP_FIELD_ALIASES, DEFAULT_CATALOG_OPTIONS, DEPS_FIELDS, PACKAGE_MANAGERS } from './constants'
import { detectWorkspaceRoot } from './io'
import { cloneDeep, detectPackageManager, getCwd, isObject } from './utils'

export async function readConfig(options: Partial<CatalogOptions>) {
  const loader = createConfigLoader<CatalogOptions>({
    sources: [
      {
        files: ['pncat.config'],
        extensions: ['ts'],
      },
    ],
    cwd: getCwd(options),
    merge: false,
  })
  const config = await loader.load()
  return config.sources.length ? normalizeConfig(config.config) : {}
}

export async function resolveConfig(options: Partial<CommandOptions>): Promise<CatalogOptions> {
  const defaults = cloneDeep(DEFAULT_CATALOG_OPTIONS)
  options = normalizeConfig(options)
  const { depFields, excludeDepFields, ...rest } = options
  const commandOptions = rest as Partial<CatalogOptions>

  if (isObject(depFields))
    commandOptions.depFields = depFields as DepFieldOptions

  const configOptions = await readConfig(commandOptions)

  // catalog rules can only be defined in the config file
  const catalogRules = configOptions.catalogRules || []
  delete configOptions.catalogRules

  const merged = deepmerge<CatalogOptions>(deepmerge(defaults, configOptions), commandOptions)

  if (!merged.agent || !PACKAGE_MANAGERS.includes(merged.agent))
    merged.agent = await detectPackageManager(merged.cwd)

  merged.cwd = merged.cwd || await detectWorkspaceRoot(merged.agent)
  merged.catalogRules = catalogRules
  merged.depFields = applyDepFields(merged.depFields, depFields, excludeDepFields)

  return sanitizeOptions(merged)
}

function normalizeConfig<T extends object>(options: T): T {
  // interop
  if ('default' in options)
    return options.default as T

  return options
}

function sanitizeOptions(options: CatalogOptions): CatalogOptions {
  if (typeof options.catalog === 'boolean')
    delete options.catalog
  return options
}

function applyDepFields(
  depFieldOptions: DepFieldOptions | undefined,
  depFields?: CommandOptions['depFields'],
  excludeDepFields?: CommandOptions['excludeDepFields'],
): DepFieldOptions | undefined {
  let nextDepFields = depFieldOptions ? { ...depFieldOptions } : undefined

  if (typeof depFields === 'string' || Array.isArray(depFields))
    nextDepFields = toDepFieldOptions(parseDepFieldValues(depFields))

  if (!excludeDepFields)
    return nextDepFields

  nextDepFields ??= {}
  for (const depField of parseDepFieldValues(excludeDepFields))
    nextDepFields[depField] = false

  return nextDepFields
}

function parseDepFieldValues(input: string | string[]): DepType[] {
  const depFields = new Set<DepType>()
  const invalidValues: string[] = []

  for (const value of splitOptionValues(input)) {
    const resolved = DEPS_FIELDS.filter(depField =>
      depField === value || CLI_DEP_FIELD_ALIASES[depField].includes(value),
    )

    if (resolved.length === 0) {
      invalidValues.push(value)
      continue
    }

    for (const depField of resolved)
      depFields.add(depField)
  }

  if (invalidValues.length > 0) {
    throw new Error(
      `invalid dep fields: ${invalidValues.join(', ')}. please use one of the following: ${DEPS_FIELDS.join(', ')}`,
    )
  }

  return Array.from(depFields)
}

function splitOptionValues(input: string | string[]): string[] {
  const values = Array.isArray(input) ? input : [input]
  return values.flatMap(value => value.split(',')).map(value => value.trim()).filter(Boolean)
}

function toDepFieldOptions(enabledDepFields: DepType[]): DepFieldOptions {
  const depFields = Object.fromEntries(DEPS_FIELDS.map(depField => [depField, false])) as DepFieldOptions

  for (const depField of enabledDepFields)
    depFields[depField] = true

  return depFields
}
