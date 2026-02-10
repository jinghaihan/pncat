import type { PackageManager, PackageMeta } from '../src/types'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { PACKAGE_MANAGERS } from '../src/constants'
import { detectWorkspaceRoot, findPackageJsonPaths, loadPackages } from '../src/io'
import { createFixtureOptions, getFixtureCwd, getFixturePath, getSnapshotPath } from './_shared'

function normalizePackages(packages: PackageMeta[]) {
  return packages.map(pkg => ({
    type: pkg.type,
    name: pkg.name,
    relative: pkg.relative,
    deps: pkg.deps.map(dep => ({
      name: dep.name,
      specifier: dep.specifier,
      source: dep.source,
      catalogName: dep.catalogName,
    })),
  }))
}

describe('io/workspace', () => {
  it('findPackageJsonPaths returns stable workspace-first paths', async () => {
    const expected = {
      pnpm: ['pnpm-workspace.yaml', 'package.json', 'packages/app/package.json'],
      yarn: ['.yarnrc.yml', 'package.json', 'packages/app/package.json'],
      bun: ['package.json', 'packages/app/package.json'],
      vlt: ['vlt.json', 'package.json', 'packages/app/package.json'],
    } as const

    for (const agent of PACKAGE_MANAGERS) {
      const paths = await findPackageJsonPaths(createFixtureOptions(agent))
      expect(paths).toEqual(expected[agent])
    }
  })

  it('keeps bun sub-packages when ignoreOtherWorkspaces is enabled', async () => {
    const paths = await findPackageJsonPaths(createFixtureOptions('bun', { ignoreOtherWorkspaces: true }))
    expect(paths).toContain('packages/app/package.json')
  })

  it('returns workspace filename + root package.json when recursive is disabled', async () => {
    const paths = await findPackageJsonPaths(createFixtureOptions('pnpm', { recursive: false }))
    expect(paths).toEqual(['pnpm-workspace.yaml', 'package.json'])
  })

  it('deduplicates root package.json for bun', async () => {
    const paths = await findPackageJsonPaths(createFixtureOptions('bun', { recursive: true }))
    expect(paths.filter(path => path === 'package.json')).toHaveLength(1)
  })

  it('filters nested workspaces and respects ignorePaths', async () => {
    const paths = await findPackageJsonPaths(createFixtureOptions('pnpm', {
      cwd: getFixturePath('workspace-filter'),
      recursive: true,
      ignoreOtherWorkspaces: true,
      ignorePaths: ['skip/**'],
    }))

    expect(paths).toContain('pnpm-workspace.yaml')
    expect(paths).toContain('package.json')
    expect(paths).toContain('packages/app/package.json')
    expect(paths).not.toContain('vendor/subrepo/package.json')
    expect(paths).not.toContain('skip/pkg/package.json')
  })

  it('detectWorkspaceRoot resolves to lockfile root from nested directories', async () => {
    const cases: PackageManager[] = ['pnpm', 'yarn', 'bun', 'vlt']

    for (const agent of cases) {
      const nested = getFixturePath(agent, 'packages', 'app')
      const root = await detectWorkspaceRoot(agent, nested)
      expect(root).toBe(resolve(getFixtureCwd(agent)))
    }
  })
})

describe('io/packages', () => {
  for (const agent of PACKAGE_MANAGERS) {
    it(`scans ${agent} fixture directory and matches package snapshot`, async () => {
      const packages = await loadPackages(createFixtureOptions(agent))
      const normalized = normalizePackages(packages)
      const snapshotPath = getSnapshotPath(`io-packages.${agent}.json`)
      await expect(`${JSON.stringify(normalized, null, 2)}\n`).toMatchFileSnapshot(snapshotPath)
    })
  }
})
