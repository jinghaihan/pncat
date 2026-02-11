import type { PackageJson } from '../../src/types'
import { describe, expect, it } from 'vitest'
import {
  cleanupPackageJSON,
  ensurePackageJsonDeps,
  ensurePnpmOverrides,
  getPackageJsonDeps,
  getPnpmOverrides,
  isPackageJsonDepSource,
} from '../../src/utils/package-json'

describe('isPackageJsonDepSource', () => {
  it('returns true for package.json dependency source fields', () => {
    expect(isPackageJsonDepSource('dependencies')).toBe(true)
    expect(isPackageJsonDepSource('devDependencies')).toBe(true)
    expect(isPackageJsonDepSource('resolutions')).toBe(true)
    expect(isPackageJsonDepSource('overrides')).toBe(true)
  })

  it('returns false for workspace and pnpm overrides sources', () => {
    expect(isPackageJsonDepSource('pnpm.overrides')).toBe(false)
    expect(isPackageJsonDepSource('pnpm-workspace')).toBe(false)
  })
})

describe('getPackageJsonDeps', () => {
  it('returns dependency map when source field is an object', () => {
    const pkgJson: PackageJson = {
      dependencies: {
        react: '^18.3.1',
      },
    }

    expect(getPackageJsonDeps(pkgJson, 'dependencies')).toEqual({
      react: '^18.3.1',
    })
  })

  it('returns undefined when source field is missing', () => {
    expect(getPackageJsonDeps({}, 'dependencies')).toBeUndefined()
  })
})

describe('ensurePackageJsonDeps', () => {
  it('returns existing dependency map when already present', () => {
    const deps = {
      react: '^18.3.1',
    }
    const pkgJson: PackageJson = { dependencies: deps }

    expect(ensurePackageJsonDeps(pkgJson, 'dependencies')).toBe(deps)
  })

  it('creates dependency map when source field is absent', () => {
    const pkgJson: PackageJson = {}

    const deps = ensurePackageJsonDeps(pkgJson, 'dependencies')

    deps.react = '^18.3.1'
    expect(pkgJson.dependencies).toEqual({
      react: '^18.3.1',
    })
  })
})

describe('getPnpmOverrides', () => {
  it('returns overrides map when pnpm overrides are present', () => {
    const pkgJson: PackageJson = {
      pnpm: {
        overrides: {
          react: '^18.3.1',
        },
      },
    }

    expect(getPnpmOverrides(pkgJson)).toEqual({
      react: '^18.3.1',
    })
  })

  it('returns undefined when pnpm overrides are absent', () => {
    expect(getPnpmOverrides({})).toBeUndefined()
  })
})

describe('ensurePnpmOverrides', () => {
  it('creates pnpm overrides map when absent', () => {
    const pkgJson: PackageJson = {}

    const overrides = ensurePnpmOverrides(pkgJson)

    overrides.react = '^18.3.1'
    expect(pkgJson.pnpm?.overrides).toEqual({
      react: '^18.3.1',
    })
  })
})

describe('cleanupPackageJSON', () => {
  it('removes empty dependency fields and keeps non-empty ones', () => {
    const cleaned = cleanupPackageJSON({
      name: 'app',
      dependencies: {
        react: '^18.3.1',
      },
      devDependencies: {},
      peerDependencies: {},
      resolutions: {},
      pnpm: {
        overrides: {},
      },
    })

    expect(cleaned.dependencies).toEqual({
      react: '^18.3.1',
    })
    expect(cleaned.devDependencies).toBeUndefined()
    expect(cleaned.peerDependencies).toBeUndefined()
    expect(cleaned.resolutions).toBeUndefined()
    expect(cleaned.pnpm?.overrides).toEqual({})
  })
})
