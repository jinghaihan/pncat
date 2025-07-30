import type { SpecifierOptions } from '../types'

function toArray<T>(array?: T | Array<T>): Array<T> {
  array = array ?? []
  return Array.isArray(array) ? array : [array]
}

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

export function specifierFilter(str: string, options?: SpecifierOptions): boolean {
  const {
    skipComplexRanges = true,
    skipRangeTypes = [],
    allowPreReleases = true,
    allowWildcards = false,
  } = options ?? {}

  if (!str.trim())
    return false

  if (str.startsWith('catalog:'))
    return true

  if (skipRangeTypes.length > 0) {
    for (const type of skipRangeTypes) {
      if (type === '||' && str.includes('||'))
        return false
      if (type === '-' && str.includes(' - '))
        return false
      if (type === '>=' && str.startsWith('>='))
        return false
      if (type === '<=' && str.startsWith('<='))
        return false
      if (type === '>' && str.startsWith('>'))
        return false
      if (type === '<' && str.startsWith('<'))
        return false
      if (type === 'x' && str.includes('x'))
        return false
      if (type === '*' && str === '*')
        return false
      if (type === 'pre-release' && str.includes('-'))
        return false
    }
    return true
  }

  if (skipComplexRanges) {
    const isComplex
      = str.includes('||')
        || str.includes(' - ')
        || /^[><=]/.test(str)

    if (isComplex)
      return false
  }

  if (!allowPreReleases && str.includes('-')) {
    return false
  }

  if (!allowWildcards && (str.includes('x') || str === '*')) {
    return false
  }

  return true
}

export function createDependenciesFilter(include?: string | string[], exclude?: string | string[], options?: SpecifierOptions) {
  const i = parseFilter(include, true)
  const e = parseFilter(exclude, false)
  return (name: string, specifier: string) => !e(name) && i(name) && specifierFilter(specifier, options)
}
