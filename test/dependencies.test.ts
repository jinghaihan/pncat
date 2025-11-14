import type { CatalogOptions } from '../src/index'
import type { PackageJson } from '../src/types'
import { beforeAll, describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config'
import { DEFAULT_CATALOG_OPTIONS } from '../src/constants'
import { parseDependencies } from '../src/io/dependencies'

describe('parseDependencies', () => {
  let config: CatalogOptions

  beforeAll(async () => {
    config = await resolveConfig({
      ...DEFAULT_CATALOG_OPTIONS,
    })
  })

  it('should parse `dependencies`', () => {
    const pkgJson: PackageJson = {
      name: 'pncat',
      private: true,
      dependencies: {
        vue: '^3.6.0',
      },
    }
    const result = parseDependencies(pkgJson, 'dependencies', () => true, config)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "catalog": false,
          "catalogName": "frontend",
          "catalogable": true,
          "name": "vue",
          "parents": [],
          "source": "dependencies",
          "specifier": "^3.6.0",
        },
      ]
    `)
  })

  it('should parse `devDependencies`', () => {
    const pkgJson: PackageJson = {
      name: 'pncat',
      private: true,
      devDependencies: {
        vite: '~7.0.0',
      },
    }
    const result = parseDependencies(pkgJson, 'devDependencies', () => true, config)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "catalog": false,
          "catalogName": "build",
          "catalogable": true,
          "name": "vite",
          "parents": [],
          "source": "devDependencies",
          "specifier": "~7.0.0",
        },
      ]
    `)
  })

  it('should parse `peerDependencies`', () => {
    const pkgJson: PackageJson = {
      name: 'pncat',
      private: true,
      peerDependencies: {
        less: '^4.4.0',
      },
    }
    const result = parseDependencies(pkgJson, 'peerDependencies', () => true, config)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "catalog": false,
          "catalogName": "style",
          "catalogable": true,
          "name": "less",
          "parents": [],
          "source": "peerDependencies",
          "specifier": "^4.4.0",
        },
      ]
    `)
  })

  it('should parse `optionalDependencies`', () => {
    const pkgJson: PackageJson = {
      name: 'pncat',
      private: true,
      optionalDependencies: {
        'node-pty': '1.0.0',
      },
    }
    const result = parseDependencies(pkgJson, 'optionalDependencies', () => true, config)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "catalog": false,
          "catalogName": "optional",
          "catalogable": true,
          "name": "node-pty",
          "parents": [],
          "source": "optionalDependencies",
          "specifier": "1.0.0",
        },
      ]
    `)
  })

  it('should parse `resolutions`', () => {
    const pkgJson: PackageJson = {
      name: 'pncat',
      private: true,
      resolutions: {
        sqlite3: '5.1.0',
      },
    }
    const result = parseDependencies(pkgJson, 'resolutions', () => true, config)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "catalog": false,
          "catalogName": "database",
          "catalogable": true,
          "name": "sqlite3",
          "parents": [],
          "source": "resolutions",
          "specifier": "5.1.0",
        },
      ]
    `)
  })

  it('should parse `pnpm.overrides`', () => {
    const pkgJson: PackageJson = {
      name: 'pncat',
      private: true,
      pnpm: {
        overrides: {
          'lodash-es': '^4.0.0',
        },
      },
    }
    const result = parseDependencies(pkgJson, 'pnpm.overrides', () => true, config)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "catalog": false,
          "catalogName": "utils",
          "catalogable": true,
          "name": "lodash-es",
          "parents": [],
          "source": "pnpm.overrides",
          "specifier": "^4.0.0",
        },
      ]
    `)
  })
})
