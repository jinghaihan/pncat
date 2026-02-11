import type { DepFilter, SpecifierOptions, SpecifierRangeType } from '@/types'
import { toArray } from '@antfu/utils'
import { COMPLEX_SPECIFIER_RANGE_TYPES } from '@/constants'

const RANGE_X_WILDCARD_RE = /^(?:(?:\d+\.)*x|\d+(?:\.\d+)*\.x(?:\.\d+)*|x(?:\.\d+)*)$/
const RANGE_ASTERISK_WILDCARD_RE = /^\*(?:\.\*)*$/
const RANGE_PRERELEASE_RE = /^(?:\d+\.){1,2}\d+-[a-z0-9.-]+$/i
const RANGE_ANY_WILDCARD_TOKEN_RE = /(?:^|\.)(?:x|\*)(?:$|\.)/
const NPM_ALIAS_RE = /^npm:(?:@[^/\s]+\/)?[^@\s]+@(.+)$/

function escapeRegExp(input: string) {
  return input.replace(/[.+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

function filterToRegex(value: string): RegExp {
  if (value.startsWith('/')) {
    const endIndex = value.lastIndexOf('/')
    const pattern = value.substring(1, endIndex)
    const flags = value.substring(endIndex + 1, value.length)
    return new RegExp(pattern, flags)
  }

  return new RegExp(`^${escapeRegExp(value).replace(/\*+/g, '.*?')}$`)
}

function parseFilter(value?: string | string[], defaultValue = true): (name: string) => boolean {
  if (!value || value.length === 0)
    return () => defaultValue

  const regexes = toArray(value).flatMap(item => item.split(',')).map(filterToRegex)
  return (name: string) => regexes.some(regex => regex.test(name))
}

export function specFilter(specifier: string, options?: SpecifierOptions): boolean {
  if (!specifier.trim())
    return false

  const normalizedSpecifier = normalizeSpecifier(specifier)
  if (normalizedSpecifier.startsWith('catalog:'))
    return true

  const {
    skipComplexRanges = true,
    skipRangeTypes = [],
    allowPreReleases = true,
    allowWildcards = false,
  } = options ?? {}

  const checks: Record<SpecifierRangeType, (input: string) => boolean> = {
    '||': input => input.includes('||'),
    '-': input => input.includes(' - '),
    '>=': input => input.startsWith('>='),
    '<=': input => input.startsWith('<='),
    '>': input => input.startsWith('>') && !input.startsWith('>='),
    '<': input => input.startsWith('<') && !input.startsWith('<='),
    'x': input => RANGE_X_WILDCARD_RE.test(input),
    '*': input => RANGE_ASTERISK_WILDCARD_RE.test(input),
    'pre-release': input => RANGE_PRERELEASE_RE.test(input),
  }

  if (skipRangeTypes.length > 0) {
    for (const type of skipRangeTypes) {
      if (checks[type](normalizedSpecifier))
        return false
    }
    return true
  }

  if (skipComplexRanges) {
    for (const type of COMPLEX_SPECIFIER_RANGE_TYPES) {
      if (checks[type](normalizedSpecifier))
        return false
    }
  }

  if (!allowPreReleases && RANGE_PRERELEASE_RE.test(normalizedSpecifier))
    return false

  if (!allowWildcards && (RANGE_X_WILDCARD_RE.test(normalizedSpecifier) || RANGE_ANY_WILDCARD_TOKEN_RE.test(normalizedSpecifier)))
    return false

  return true
}

function normalizeSpecifier(specifier: string): string {
  const npmAliasMatch = specifier.match(NPM_ALIAS_RE)
  return npmAliasMatch ? npmAliasMatch[1] : specifier
}

function packageNameFilter(name: string): boolean {
  if (name.startsWith('@')) {
    const secondAt = name.indexOf('@', 1)
    return secondAt === -1
  }
  return !name.includes('@')
}

function protocolsFilter(specifier: string, protocols?: string[]): boolean {
  if (!protocols)
    return true
  return !protocols.some(protocol => specifier.startsWith(protocol))
}

export function createDependenciesFilter(
  include?: string | string[],
  exclude?: string | string[],
  protocols?: string[],
  specifierOptions?: SpecifierOptions,
): DepFilter {
  const includeFilter = parseFilter(include, true)
  const excludeFilter = parseFilter(exclude, false)

  return (name: string, specifier: string) => {
    if (excludeFilter(name) || !includeFilter(name))
      return false
    if (!protocolsFilter(specifier, protocols))
      return false
    if (!packageNameFilter(name))
      return false
    return specFilter(specifier, specifierOptions)
  }
}
