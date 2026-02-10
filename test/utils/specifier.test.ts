import type { SpecifierRule } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { cleanSpec, mostSpecificRule, parseSpec } from '../../src/utils'
import { createFixtureOptions } from '../_shared'

describe('parseSpec', () => {
  it('parses regular package spec', () => {
    expect(parseSpec('react@^18.3.1')).toEqual({
      name: 'react',
      specifier: '^18.3.1',
    })
  })

  it('parses scoped package spec', () => {
    expect(parseSpec('@types/node@^22.10.0')).toEqual({
      name: '@types/node',
      specifier: '^22.10.0',
    })
  })
})

describe('cleanSpec', () => {
  it('returns null for allowed protocol specifiers', () => {
    const options = createFixtureOptions('pnpm', { allowedProtocols: ['workspace', 'link'] })
    expect(cleanSpec('workspace:*', options)).toBeNull()
  })

  it('returns valid versions and coerces version ranges', () => {
    expect(cleanSpec('v1.2.3')).toBe('1.2.3')
    expect(cleanSpec('^1.2.3')).toBe('1.2.3')
    expect(cleanSpec('not-a-version')).toBeNull()
  })
})

describe('mostSpecificRule', () => {
  it('throws when called with an empty rules array', () => {
    expect(() => mostSpecificRule([])).toThrowError('Requires at least one rule')
  })

  it('selects subset ranges as more specific', () => {
    const rules: SpecifierRule[] = [
      { specifier: '^1.0.0', suffix: 'major' },
      { specifier: '^1.2.0', suffix: 'minor' },
    ]
    expect(mostSpecificRule(rules)).toEqual(rules[1])
  })

  it('keeps current best when its minimum version is greater', () => {
    const rules: SpecifierRule[] = [
      { specifier: '>=2.0.0 <4.0.0', suffix: 'high' },
      { specifier: '>=1.0.0 <3.0.0', suffix: 'low' },
    ]
    expect(mostSpecificRule(rules)).toEqual(rules[0])
  })

  it('chooses current rule when its minimum version is greater', () => {
    const rules: SpecifierRule[] = [
      { specifier: '>=1.0.0 <3.0.0', suffix: 'low' },
      { specifier: '>=2.0.0 <4.0.0', suffix: 'high' },
    ]
    expect(mostSpecificRule(rules)).toEqual(rules[1])
  })

  it('keeps best when best is subset of current', () => {
    const rules: SpecifierRule[] = [
      { specifier: '^1.2.0', suffix: 'narrow' },
      { specifier: '^1.0.0', suffix: 'broad' },
    ]
    expect(mostSpecificRule(rules)).toEqual(rules[0])
  })

  it('throws when rules contain invalid semver comparators', () => {
    const rules: SpecifierRule[] = [
      { specifier: '^1.0.0', suffix: 'best' },
      { specifier: 'file:../pkg', suffix: 'invalid' },
    ]

    expect(() => mostSpecificRule(rules)).toThrow()
  })
})
