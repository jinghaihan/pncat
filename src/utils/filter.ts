import type { DepFilter, SpecifierOptions, SpecifierRangeType } from '../types'
import { toArray } from '@antfu/utils'

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
    'x': s => s.includes('x'),
    '*': s => s === '*',
    'pre-release': s => s.includes('-'),
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
  if (!allowPreReleases && str.includes('-'))
    return false

  // Check wildcards
  if (!allowWildcards && (str.includes('x') || str === '*'))
    return false

  return true
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
    return specFilter(specifier, specOptions)
  }
}
