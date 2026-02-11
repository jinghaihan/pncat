import type { CatalogOptions, ParsedSpec, SpecifierRule } from '@/types'
import { clean, coerce, gt, minVersion, subset, valid } from 'semver'

export function parseSpec(spec: string): ParsedSpec {
  const { name, specifier } = splitPackageSpec(spec.trim())

  return { name, specifier }
}

export function cleanSpec(spec: string, options?: CatalogOptions): string | null {
  if (options?.allowedProtocols?.some(protocol => spec.startsWith(protocol)))
    return null

  const normalized = clean(spec)
  const validVersion = valid(normalized)
  if (validVersion)
    return validVersion

  const coerced = coerce(spec)
  if (coerced)
    return coerced.version

  return null
}

export function mostSpecificRule(rules: SpecifierRule[]): SpecifierRule {
  if (rules.length === 0)
    throw new Error('Requires at least one rule')

  return rules.reduce((best, current) => {
    if (subset(current.specifier, best.specifier))
      return current

    if (subset(best.specifier, current.specifier))
      return best

    const currentMin = minVersion(current.specifier)
    const bestMin = minVersion(best.specifier)

    if (currentMin && bestMin)
      return gt(bestMin, currentMin) ? best : current

    return best
  })
}

function splitPackageSpec(spec: string): { name: string, specifier?: string } {
  if (!spec.startsWith('@')) {
    const atIndex = spec.indexOf('@')
    if (atIndex === -1)
      return { name: spec }
    return {
      name: spec.slice(0, atIndex),
      specifier: spec.slice(atIndex + 1),
    }
  }

  const slashIndex = spec.indexOf('/')
  if (slashIndex === -1)
    return { name: spec }

  const atIndex = spec.indexOf('@', slashIndex + 1)
  if (atIndex === -1)
    return { name: spec }

  return {
    name: spec.slice(0, atIndex),
    specifier: spec.slice(atIndex + 1),
  }
}
