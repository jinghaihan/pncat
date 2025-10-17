import { describe, expect, it } from 'vitest'
import { parseArgs, parseCommandOptions } from '../src/utils/process'

describe('parseArgs', () => {
  it('should parse args', () => {
    expect(parseArgs(['vue', '--catalog', 'frontend'])).toEqual({
      options: { catalog: 'frontend' },
      deps: ['vue'],
    })
  })
})

describe('parseCommandOptions', () => {
  it('should parse pnpm options', () => {
    expect(parseCommandOptions(['vue', '--catalog', 'frontend'])).toEqual({
      deps: ['vue'],
      isRecursive: false,
      isDev: false,
      isPeer: false,
      isOptional: false,
    })
  })

  it('should parse pnpm options with recursive', () => {
    const expected = {
      deps: ['vue'],
      isRecursive: true,
      isDev: false,
      isPeer: false,
      isOptional: false,
    }

    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '-r'])).toEqual(expected)
    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '--recursive'])).toEqual(expected)
  })

  it('should parse pnpm options with dev', () => {
    const expected = {
      deps: ['vue'],
      isRecursive: false,
      isDev: true,
      isPeer: false,
      isOptional: false,
    }

    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '-D'])).toEqual(expected)
    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '--save-dev'])).toEqual(expected)
  })

  it('should parse pnpm options with peer', () => {
    const expected = {
      deps: ['vue'],
      isRecursive: false,
      isDev: false,
      isPeer: true,
      isOptional: false,
    }

    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '-P'])).toEqual(expected)
    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '--save-peer'])).toEqual(expected)
  })

  it('should parse pnpm options with optional', () => {
    const expected = {
      deps: ['vue'],
      isRecursive: false,
      isDev: false,
      isPeer: false,
      isOptional: true,
    }

    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '-O'])).toEqual(expected)
    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '--save-optional'])).toEqual(expected)
  })

  it('should parse pnpm options with prod', () => {
    const expected = {
      deps: ['vue'],
      isRecursive: false,
      isDev: false,
      isPeer: false,
      isOptional: false,
    }

    expect(parseCommandOptions(['vue', '--catalog', 'frontend', '--save-prod'])).toEqual(expected)
  })
})
