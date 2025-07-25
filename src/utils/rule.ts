import type { CatalogOptions, RawDep, SpecifierRule } from '../types'
import semver from 'semver'
import { DEP_TYPE_GROUP_NAME_MAP } from '../constants'

function isDepMatched(depName: string, match: string | RegExp | (string | RegExp)[]): boolean {
  if (Array.isArray(match)) {
    return match.some(m => (typeof m === 'string' ? depName === m : m.test(depName)))
  }
  else if (typeof match === 'string') {
    return depName === match
  }
  else if (match instanceof RegExp) {
    return match.test(depName)
  }
  return false
}

function extractVersionFromSpecifier(specifier: string, options: CatalogOptions): string | null {
  if (options.allowedProtocols.some(p => specifier.startsWith(p))) {
    return null
  }

  // Remove common prefixes and extract version
  const cleanSpec = specifier.replace(/^[\^~>=<]+/, '')

  // Try to get valid semver version
  const version = semver.valid(cleanSpec)
  if (version) {
    return version
  }

  // Try to coerce version (handles cases like "3.0" -> "3.0.0")
  const coerced = semver.coerce(cleanSpec)
  if (coerced) {
    return coerced.version
  }

  return null
}

function findMostSpecificRange(specifierRules: SpecifierRule[], version: string): SpecifierRule {
  // Strategy: find the specifier rule with the narrowest scope
  // Priority: ranges with upper bounds > ranges without upper bounds
  // Among ranges with upper bounds: smaller range wins
  // Among ranges without upper bounds: higher minimum version wins

  let mostSpecific = specifierRules[0]
  let bestScore = calculateRangeSpecificity(specifierRules[0].specifier, version)

  for (let i = 1; i < specifierRules.length; i++) {
    const currentScore = calculateRangeSpecificity(specifierRules[i].specifier, version)
    if (currentScore > bestScore) {
      mostSpecific = specifierRules[i]
      bestScore = currentScore
    }
  }

  return mostSpecific
}

function calculateRangeSpecificity(range: string, _version: string): number {
  // Parse the range to understand its constraints
  const hasUpperBound = range.includes('<') || range.includes(' - ')
  const hasLowerBound = range.includes('>') || range.includes('^') || range.includes('~')

  let score = 0

  // Ranges with both upper and lower bounds are more specific
  if (hasUpperBound && hasLowerBound) {
    score += 1000
  }
  // Ranges with only upper bounds
  else if (hasUpperBound) {
    score += 500
  }
  // Ranges with only lower bounds
  else if (hasLowerBound) {
    score += 100
  }

  // For ranges like ">=X.Y.Z", higher X.Y.Z means more specific
  const minVersionMatch = range.match(/>=?(\d+\.\d+\.\d+)/)
  if (minVersionMatch) {
    const minVersion = minVersionMatch[1]
    const minVersionParts = minVersion.split('.').map(Number)
    // Add points based on minimum version (higher version = more specific)
    score += minVersionParts[0] * 10 + minVersionParts[1] * 1 + minVersionParts[2] * 0.1
  }

  return score
}

export function getDepCatalogName(dep: RawDep, options: CatalogOptions): string {
  for (const rule of options.catalogRules ?? []) {
    const { name, match, specifierRules } = rule

    if (!isDepMatched(dep.name, match))
      continue

    // If no specifier rules configured, use original logic
    if (!specifierRules?.length)
      return name

    // Extract version from specifier
    const version = extractVersionFromSpecifier(dep.specifier, options)
    if (!version)
      return name

    // Find all matching specifier rules that apply to this specific dependency
    const matchingRules = specifierRules.filter((specifierRule) => {
      // If specifier rule has its own match criteria, check if this dep matches
      if (specifierRule.match && !isDepMatched(dep.name, specifierRule.match)) {
        return false
      }

      return semver.satisfies(version, specifierRule.specifier)
    })

    if (matchingRules.length === 0)
      return name

    // If only one match, use it
    if (matchingRules.length === 1) {
      const rule = matchingRules[0]
      return rule.name || `${name}-${rule.suffix}`
    }

    // Multiple matches: find the most specific rule
    const mostSpecific = findMostSpecificRange(matchingRules, version)
    return mostSpecific.name || `${name}-${mostSpecific.suffix}`
  }

  return DEP_TYPE_GROUP_NAME_MAP[dep.source] || 'default'
}
