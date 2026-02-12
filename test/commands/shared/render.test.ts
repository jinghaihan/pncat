import type { PackageJsonMeta, RawDep } from '@/types'
import c from 'ansis'
import { describe, expect, it } from 'vitest'
import { renderChanges } from '@/commands/shared'

function createDep(name: string, source: RawDep['source'], specifier: string, catalogName: string): RawDep {
  return {
    name,
    specifier,
    source,
    parents: [],
    catalogable: true,
    catalogName,
    isCatalog: false,
  }
}

function createUpdatedPackages(deps: RawDep[]): Record<string, PackageJsonMeta> {
  return {
    app: {
      type: 'package.json',
      name: 'app',
      private: true,
      version: '0.0.0',
      filepath: '/repo/package.json',
      relative: 'package.json',
      raw: { name: 'app' },
      deps,
    },
  }
}

function createUpdatedPackagesForMonorepo(
  appDeps: RawDep[],
  libDeps: RawDep[],
): Record<string, PackageJsonMeta> {
  return {
    app: {
      type: 'package.json',
      name: 'app',
      private: true,
      version: '0.0.0',
      filepath: '/repo/packages/app/package.json',
      relative: 'packages/app/package.json',
      raw: { name: 'app' },
      deps: appDeps,
    },
    lib: {
      type: 'package.json',
      name: 'lib',
      private: true,
      version: '0.0.0',
      filepath: '/repo/packages/lib/package.json',
      relative: 'packages/lib/package.json',
      raw: { name: 'lib' },
      deps: libDeps,
    },
  }
}

describe('renderChanges', () => {
  it('returns empty string when no dependencies are provided', () => {
    expect(renderChanges([], {})).toBe('')
  })

  it('renders package sections and dependency summary', () => {
    const deps = [
      createDep('react', 'dependencies', '^18.3.1', 'prod'),
      createDep('vitest', 'devDependencies', '^4.0.0', 'test'),
    ]
    const output = c.strip(renderChanges(deps, createUpdatedPackages(deps)))

    expect(output).toContain('app package.json')
    expect(output).toContain('react')
    expect(output).toContain('vitest')
    expect(output).toContain('1 package 2 dependencies')
  })

  it('renders a dependency for every matched updated package', () => {
    const lodash = createDep('lodash-es', 'dependencies', '^4.17.23', 'prod')
    const output = c.strip(renderChanges(
      [lodash],
      createUpdatedPackagesForMonorepo([lodash], [lodash]),
    ))

    expect(output).toContain('app packages/app/package.json')
    expect(output).toContain('lib packages/lib/package.json')
    expect(output).toContain('2 packages 1 dependency')
  })
})
