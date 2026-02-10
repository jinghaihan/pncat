import type { PackageManager, PackageMeta } from '../src/types'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { PACKAGE_MANAGERS } from '../src/constants'
import { detectWorkspaceRoot, findPackageJsonPaths, loadPackages } from '../src/io'
import { createFixtureOptions } from './_shared'

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

  it('detectWorkspaceRoot falls back to current directory when no lock is found', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pncat-no-lock-'))
    const nested = join(root, 'packages', 'app')
    await mkdir(nested, { recursive: true })

    const detected = await detectWorkspaceRoot('pnpm', nested)
    expect(detected).toBe(resolve(nested))
  })

  it('detectWorkspaceRoot resolves to lockfile root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pncat-lock-root-'))
    const nested = join(root, 'packages', 'app')
    await mkdir(nested, { recursive: true })
    await writeFile(join(root, 'bun.lock'), '# lock\n', 'utf-8')

    const detected = await detectWorkspaceRoot('bun', nested)
    expect(detected).toBe(resolve(root))
  })

  it('filters nested workspaces and respects ignorePaths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pncat-ignore-'))

    await mkdir(join(root, 'packages', 'app'), { recursive: true })
    await mkdir(join(root, 'vendor', 'subrepo'), { recursive: true })
    await mkdir(join(root, 'skip', 'pkg'), { recursive: true })

    await writeFile(join(root, 'package.json'), '{"name":"root"}\n', 'utf-8')
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf-8')
    await writeFile(join(root, 'packages', 'app', 'package.json'), '{"name":"app"}\n', 'utf-8')
    await writeFile(join(root, 'vendor', 'subrepo', 'pnpm-workspace.yaml'), 'packages: []\n', 'utf-8')
    await writeFile(join(root, 'vendor', 'subrepo', 'package.json'), '{"name":"subrepo"}\n', 'utf-8')
    await writeFile(join(root, 'skip', 'pkg', 'package.json'), '{"name":"skip"}\n', 'utf-8')

    const paths = await findPackageJsonPaths(createFixtureOptions('pnpm', {
      cwd: root,
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

describe('io/packages', () => {
  const expected: Record<PackageManager, ReturnType<typeof normalizePackages>> = {
    pnpm: [
      {
        type: 'pnpm-workspace.yaml',
        name: 'pnpm-catalog:default',
        relative: 'pnpm-workspace.yaml',
        deps: [
          { name: 'react', specifier: '^18.3.1', source: 'pnpm-workspace', catalogName: 'default' },
        ],
      },
      {
        type: 'pnpm-workspace.yaml',
        name: 'pnpm-catalog:test',
        relative: 'pnpm-workspace.yaml',
        deps: [
          { name: 'vitest', specifier: '^4.0.0', source: 'pnpm-workspace', catalogName: 'test' },
        ],
      },
      {
        type: 'pnpm-workspace.yaml',
        name: 'pnpm-workspace:overrides',
        relative: 'pnpm-workspace.yaml',
        deps: [
          { name: 'react', specifier: 'catalog:', source: 'pnpm-workspace', catalogName: 'override' },
        ],
      },
      {
        type: 'package.json',
        name: 'fixture-pnpm',
        relative: 'package.json',
        deps: [],
      },
      {
        type: 'package.json',
        name: 'app-pnpm',
        relative: 'packages/app/package.json',
        deps: [
          { name: 'react', specifier: 'catalog:', source: 'dependencies', catalogName: 'prod' },
          { name: 'vitest', specifier: 'catalog:test', source: 'devDependencies', catalogName: 'dev' },
        ],
      },
    ],
    yarn: [
      {
        type: '.yarnrc.yml',
        name: 'yarn-catalog:default',
        relative: '.yarnrc.yml',
        deps: [
          { name: 'vue', specifier: '^3.5.0', source: 'yarn-workspace', catalogName: 'default' },
        ],
      },
      {
        type: '.yarnrc.yml',
        name: 'yarn-catalog:lint',
        relative: '.yarnrc.yml',
        deps: [
          { name: 'eslint', specifier: '^9.0.0', source: 'yarn-workspace', catalogName: 'lint' },
        ],
      },
      {
        type: 'package.json',
        name: 'fixture-yarn',
        relative: 'package.json',
        deps: [],
      },
      {
        type: 'package.json',
        name: 'app-yarn',
        relative: 'packages/app/package.json',
        deps: [
          { name: 'vue', specifier: 'catalog:', source: 'dependencies', catalogName: 'prod' },
          { name: 'eslint', specifier: 'catalog:lint', source: 'devDependencies', catalogName: 'dev' },
        ],
      },
    ],
    bun: [
      { type: 'bun-workspace', name: 'bun-catalog:default', relative: 'package.json', deps: [{ name: 'solid-js', specifier: '^1.9.0', source: 'bun-workspace', catalogName: 'default' }] },
      { type: 'bun-workspace', name: 'bun-catalog:test', relative: 'package.json', deps: [{ name: 'vitest', specifier: '^4.0.0', source: 'bun-workspace', catalogName: 'test' }] },
      { type: 'package.json', name: 'fixture-bun', relative: 'package.json', deps: [] },
      {
        type: 'package.json',
        name: 'app-bun',
        relative: 'packages/app/package.json',
        deps: [
          { name: 'solid-js', specifier: 'catalog:', source: 'dependencies', catalogName: 'prod' },
          { name: 'vitest', specifier: 'catalog:test', source: 'devDependencies', catalogName: 'dev' },
        ],
      },
    ],
    vlt: [
      {
        type: 'vlt.json',
        name: 'vlt-catalog:default',
        relative: 'vlt.json',
        deps: [
          { name: 'svelte', specifier: '^5.0.0', source: 'vlt-workspace', catalogName: 'default' },
        ],
      },
      {
        type: 'vlt.json',
        name: 'vlt-catalog:build',
        relative: 'vlt.json',
        deps: [
          { name: 'vite', specifier: '^7.0.0', source: 'vlt-workspace', catalogName: 'build' },
        ],
      },
      {
        type: 'package.json',
        name: 'fixture-vlt',
        relative: 'package.json',
        deps: [],
      },
      {
        type: 'package.json',
        name: 'app-vlt',
        relative: 'packages/app/package.json',
        deps: [
          { name: 'svelte', specifier: 'catalog:', source: 'dependencies', catalogName: 'prod' },
          { name: 'vite', specifier: 'catalog:', source: 'devDependencies', catalogName: 'dev' },
        ],
      },
    ],
  }

  for (const agent of PACKAGE_MANAGERS) {
    it(`scans ${agent} fixture directory and returns expected package data`, async () => {
      const packages = await loadPackages(createFixtureOptions(agent))
      expect(normalizePackages(packages)).toEqual(expected[agent])
    })
  }
})
