import type { DepFilter, SpecifierOptions, SpecifierRangeType } from '../types'
import { toArray } from '@antfu/utils'

// Matches versions with x wildcard like 1.x, 1.2.x, x.1, etc.
const X_REGEXP = /^(?:(?:\d+\.)*x|\d+(?:\.\d+)*\.x(?:\.\d+)*|x(?:\.\d+)*)$/
// Matches pure * wildcard
const ASTERISK_REGEXP = /^\*(?:\.\*)*$/
// Pre-release versions (must be checked before wildcards)
const PRE_RELEASE_REGEXP = /^(?:\d+\.){1,2}\d+-[a-z0-9.-]+$/i
// Matches any version containing x or * wildcard (but not pre-release)
const WILDCARD_REGEXP = /(?:^|\.)(?:x|\*)(?:$|\.)/

function escapeRegExp(str: string) {
  return str.replace(/[.+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function filterToRegex(str: string) {
  if (str.startsWith('/')) {
    const endIndex = str.lastIndexOf('/')
    const regexp = str.substring(1, endIndex)
    const flags = str.substring(endIndex + 1, str.length)
    return new RegExp(regexp, flags)
  }
  return new RegExp(`^${escapeRegExp(str).replace(/\*+/g, '.*?')}$`)
}

export function parseFilter(str?: string | string[], defaultValue = true): ((name: string) => boolean) {
  if (!str || str.length === 0)
    return () => defaultValue

  const regex = toArray(str).flatMap(i => i.split(',')).map(filterToRegex)

  return (name) => {
    for (const reg of regex) {
      if (reg.test(name))
        return true
    }
    return false
  }
}

export function specFilter(str: string, options?: SpecifierOptions): boolean {
  if (!str.trim())
    return false

  if (str.startsWith('catalog:'))
    return true

  const {
    skipComplexRanges = true,
    skipRangeTypes = [],
    allowPreReleases = true,
    allowWildcards = false,
  } = options ?? {}

  // Define range type checks
  const rangeTypeChecks: Record<SpecifierRangeType, (s: string) => boolean> = {
    '||': s => s.includes('||'),
    '-': s => s.includes(' - '),
    '>=': s => s.startsWith('>='),
    '<=': s => s.startsWith('<='),
    '>': s => s.startsWith('>') && !s.startsWith('>='),
    '<': s => s.startsWith('<') && !s.startsWith('<='),
    'x': s => X_REGEXP.test(s),
    '*': s => ASTERISK_REGEXP.test(s),
    'pre-release': s => PRE_RELEASE_REGEXP.test(s),
  }

  // Check skipRangeTypes first (takes priority)
  if (skipRangeTypes.length > 0) {
    for (const type of skipRangeTypes) {
      if (rangeTypeChecks[type](str))
        return false
    }
    return true
  }

  // Check skipComplexRanges
  if (skipComplexRanges) {
    for (const type of ['||', '-', '>=', '<=', '>', '<']) {
      if (rangeTypeChecks[type as SpecifierRangeType](str))
        return false
    }
  }

  // Check pre-releases
  if (!allowPreReleases && PRE_RELEASE_REGEXP.test(str))
    return false

  // Check wildcards
  if (!allowWildcards && (X_REGEXP.test(str) || WILDCARD_REGEXP.test(str)))
    return false

  return true
}

export function packageNameFilter(name: string): boolean {
  if (name.startsWith('@')) {
    const secondAt = name.indexOf('@', 1)
    return secondAt === -1
  }
  return !name.includes('@')
}

export function protocolsFilter(str: string, protocols?: string[]) {
  if (protocols) {
    return !protocols.some(p => str.startsWith(p))
  }
  return true
}

export function createDependenciesFilter(
  include?: string | string[],
  exclude?: string | string[],
  protocols?: string[],
  specOptions?: SpecifierOptions,
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
    return specFilter(specifier, specOptions)
  }
}
