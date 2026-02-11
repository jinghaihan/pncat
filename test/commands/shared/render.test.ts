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
})
