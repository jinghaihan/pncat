import type { CatalogOptions, ParsedSpec, SpecifierRule } from '../types'
import { clean, coerce, gt, minVersion, subset, valid } from 'semver'

export function parseSpec(spec: string): ParsedSpec {
  let name: string | undefined
  let specifier: string | undefined
  const parts = spec.split(/@/g)
  if (parts[0] === '') { // @scope/name
    name = parts.slice(0, 2).join('@')
    specifier = parts[2]
  }
  else {
    name = parts[0]
    specifier = parts[1]
  }
  return { name, specifier }
}

export function cleanSpec(spec: string, options?: CatalogOptions): string | null {
  if (options?.allowedProtocols?.some(p => spec.startsWith(p)))
    return null

  const cleanSpec = clean(spec)
  const version = valid(cleanSpec)
  if (version)
    return version

  const coerced = coerce(spec)
  if (coerced)
    return coerced.version

  return null
}

export function sortSpecs(specs: string[], options?: CatalogOptions) {
  return specs.sort((a, b) => {
    const ver1 = cleanSpec(a, options)
    const ver2 = cleanSpec(b, options)
    if (ver1 && ver2)
      return gt(ver1, ver2) ? -1 : 1
    return 0
  })
}

export function mostSpecificRule(matchingRules: SpecifierRule[]): SpecifierRule {
  if (!matchingRules.length)
    return matchingRules[0]

  return matchingRules.reduce((mostSpecific, current) => {
    if (subset(current.specifier, mostSpecific.specifier))
      return current

    if (subset(mostSpecific.specifier, current.specifier))
      return mostSpecific

    const minVer1 = minVersion(mostSpecific.specifier)
    const minVer2 = minVersion(current.specifier)

    if (minVer1 && minVer2) {
      if (gt(minVer1, minVer2))
        return mostSpecific
      return current
    }

    return mostSpecific
  })
}
