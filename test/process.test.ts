import { describe, expect, it } from 'vitest'
import { parseArgs, parseCommandOptions } from '../src/utils/process'

describe('parseArgs', () => {
  it('should parse args', () => {
    expect(parseArgs(['vue', '--catalog', 'frontend'])).toEqual({
      options: { catalog: 'frontend' },
      deps: ['vue'],
    })
  })

  it('should parse recursive flag', () => {
    expect(parseArgs(['vue', 'eslint', '-r'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { r: true },
    })

    expect(parseArgs(['vue', 'eslint', '--recursive'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { recursive: true },
    })
  })

  it('should parse args with dev flag', () => {
    expect(parseArgs(['vue', 'eslint', '-D'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { D: true },
    })

    expect(parseArgs(['vue', 'eslint', '--save-dev'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { 'save-dev': true },
    })
  })

  it('should parse args with optional flag', () => {
    expect(parseArgs(['vue', 'eslint', '-O'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { O: true },
    })

    expect(parseArgs(['vue', 'eslint', '--save-optional'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { 'save-optional': true },
    })
  })

  it('should parse args with peer flag', () => {
    expect(parseArgs(['vue', 'eslint', '-P'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { P: true },
    })

    expect(parseArgs(['vue', 'eslint', '--save-peer'])).toEqual({
      deps: ['vue', 'eslint'],
      options: { 'save-peer': true },
    })
  })

  it('parse flag correctly regardless of their position', () => {
    expect(parseArgs(['vue', '-r', 'eslint', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { r: true },
    })
    expect(parseArgs(['vue', 'eslint', '--recursive', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { recursive: true },
    })

    expect(parseArgs(['vue', '-D', 'eslint', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { D: true },
    })
    expect(parseArgs(['vue', 'eslint', '--save-dev', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { 'save-dev': true },
    })

    expect(parseArgs(['vue', 'eslint', '-O', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { O: true },
    })
    expect(parseArgs(['vue', 'eslint', '--save-optional', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { 'save-optional': true },
    })

    expect(parseArgs(['vue', 'eslint', '-P', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { P: true },
    })
    expect(parseArgs(['vue', 'eslint', '--save-peer', 'lodash-es'])).toEqual({
      deps: ['vue', 'eslint', 'lodash-es'],
      options: { 'save-peer': true },
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
