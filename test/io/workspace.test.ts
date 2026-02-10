import type { PackageManager } from '../../src/types'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { PACKAGE_MANAGERS } from '../../src/constants'
import { detectWorkspaceRoot, findPackageJsonPaths } from '../../src/io'
import { createFixtureOptions, getFixtureCwd, getFixturePath } from '../_shared'

describe('findPackageJsonPaths', () => {
  it('returns stable workspace-first paths', async () => {
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
})

describe('detectWorkspaceRoot', () => {
  it('resolves to lockfile root from nested directories', async () => {
    const cases: PackageManager[] = ['pnpm', 'yarn', 'bun', 'vlt']

    for (const agent of cases) {
      const nested = getFixturePath(agent, 'packages', 'app')
      const root = await detectWorkspaceRoot(agent, nested)
      expect(root).toBe(resolve(getFixtureCwd(agent)))
    }
  })
})
