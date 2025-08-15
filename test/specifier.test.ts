import { describe, expect, it } from 'vitest'
import { cleanSpec, mostSpecificRule, parseSpec, sortSpecs } from '../src/utils/specifier'

it('parseSpec', () => {
  expect(parseSpec('pncat')).toEqual({ name: 'pncat' })
  expect(parseSpec('pncat@^1')).toEqual({ name: 'pncat', specifier: '^1' })
  expect(parseSpec('@clack/prompts')).toEqual({ name: '@clack/prompts' })
  expect(parseSpec('@clack/prompts@latest')).toEqual({ name: '@clack/prompts', specifier: 'latest' })
  expect(parseSpec('@clack/prompts@workspace')).toEqual({ name: '@clack/prompts', specifier: 'workspace' })
})

it('cleanSpec', () => {
  expect(cleanSpec('3')).toBe('3.0.0')
  expect(cleanSpec('~3')).toBe('3.0.0')
  expect(cleanSpec('^3')).toBe('3.0.0')
  expect(cleanSpec('!3')).toBe('3.0.0')
  expect(cleanSpec('3.0.0')).toBe('3.0.0')
  expect(cleanSpec('3.0.0-beta.1')).toBe('3.0.0-beta.1')
})

it('sortSpecs', () => {
  expect(sortSpecs(['^2.0.0', '~3.0.0', '1.0.0'])).toEqual(['~3.0.0', '^2.0.0', '1.0.0'])
  expect(sortSpecs(['^2.0.0-beta.1', '~3.0.0', '>=1.0.0'])).toEqual(['~3.0.0', '^2.0.0-beta.1', '>=1.0.0'])
})

describe('mostSpecificRule', () => {
  it('should choose rule with higher minimum version', () => {
    const result = mostSpecificRule([
      { specifier: '>=1.0.0' },
      { specifier: '>=2.0.0' },
    ])
    expect(result.specifier).toEqual('>=2.0.0')
  })

  it('should choose rule with narrower version range', () => {
    const result = mostSpecificRule([
      { specifier: '>=1.0.0 <2.0.0' },
      { specifier: '>=1.5.0 <2.0.0' },
    ])
    expect(result.specifier).toEqual('>=1.5.0 <2.0.0')
  })

  it('should choose more specific range with caret vs range', () => {
    const result = mostSpecificRule([
      { specifier: '>=1.0.0 <3.0.0' },
      { specifier: '^2.0.0' },
    ])
    expect(result.specifier).toEqual('^2.0.0')
  })

  it('should choose more specific range with tilde vs caret', () => {
    const result = mostSpecificRule([
      { specifier: '^2.0.0' },
      { specifier: '~2.1.0' },
    ])
    expect(result.specifier).toEqual('~2.1.0')
  })

  it('should handle non-overlapping ranges', () => {
    const result = mostSpecificRule([
      { specifier: '>=1.0.0 <2.0.0' },
      { specifier: '>=3.0.0 <4.0.0' },
    ])
    expect(result.specifier).toEqual('>=3.0.0 <4.0.0')
  })

  it('should handle prerelease versions', () => {
    const result = mostSpecificRule([
      { specifier: '>=2.0.0-alpha' },
      { specifier: '>=2.0.0' },
    ])
    expect(result.specifier).toEqual('>=2.0.0')
  })

  it('should handle Vue-like version rules', () => {
    const result = mostSpecificRule([
      { specifier: '>=2.0.0', suffix: 'legacy' },
      { specifier: '>=2.7.0 <3.0.0', suffix: 'composition-api' },
      { specifier: '>=3.0.0', suffix: 'next' },
    ])
    expect(result.suffix).toEqual('next')
  })
})
