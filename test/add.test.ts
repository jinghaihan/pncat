import type { PackageJson, RawDep } from '../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCommand } from '../src/commands/add'
import { resolveConfig } from '../src/config'
import { DEFAULT_CATALOG_OPTIONS } from '../src/constants'

// Mock only the essential dependencies for the core logic
vi.mock('../src/utils/workspace', () => ({
  readPackageJSON: vi.fn(),
  confirmWorkspaceChanges: vi.fn().mockImplementation(async (modifier) => {
    await modifier() // Execute the modifier to test workspace changes
  }),
}))

vi.mock('../src/io/workspace', () => ({
  findWorkspaceRoot: vi.fn().mockResolvedValue('/test/workspace'),
}))

// Mock side effects that don't affect core logic
vi.mock('../src/utils/process', () => ({
  runInstallCommand: vi.fn(),
}))

vi.mock('../src/commands/resolver', () => ({
  resolveAdd: vi.fn(),
}))

vi.mock('../src/workspace', () => ({
  Workspace: vi.fn().mockImplementation(() => ({
    getCwd: vi.fn().mockReturnValue('/test/cwd'),
  })),
}))

vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
  log: { success: vi.fn() },
}))

describe('addCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock process.argv with default value
    Object.defineProperty(process, 'argv', {
      value: ['node', 'pncat', 'add', 'test-package'],
      writable: true,
    })
  })

  async function setupTest(packageJson: PackageJson, dependencies: RawDep[], isDev = false) {
    const config = await resolveConfig({ ...DEFAULT_CATALOG_OPTIONS })
    const mockReadPackageJSON = vi.mocked((await import('../src/utils/workspace')).readPackageJSON)
    const mockResolveAdd = vi.mocked((await import('../src/commands/resolver')).resolveAdd)

    mockReadPackageJSON.mockResolvedValue({
      pkgJson: packageJson,
      pkgPath: '/test/package.json',
    })

    mockResolveAdd.mockResolvedValue({
      isDev,
      dependencies,
    })

    return config
  }

  it('should generate "catalog:" for default catalog dependencies', async () => {
    const packageJson: PackageJson = {
      name: 'test-package',
      dependencies: {},
    }

    const dependencies: RawDep[] = [{
      name: 'eslint',
      specifier: '^8.0.0',
      catalogName: 'default',
      source: 'dependencies',
      catalog: false,
      catalogable: true,
    }]

    const config = await setupTest(packageJson, dependencies)
    await addCommand(config)

    expect(packageJson.dependencies).toEqual({
      eslint: 'catalog:',
    })
  })

  it('should generate "catalog:named" for named catalog dependencies', async () => {
    const packageJson: PackageJson = {
      name: 'test-package',
      dependencies: {},
    }

    const dependencies: RawDep[] = [{
      name: 'vue',
      specifier: '^3.0.0',
      catalogName: 'frontend',
      source: 'dependencies',
      catalog: false,
      catalogable: true,
    }]

    const config = await setupTest(packageJson, dependencies)
    await addCommand(config)

    expect(packageJson.dependencies).toEqual({
      vue: 'catalog:frontend',
    })
  })

  it('should handle multiple dependencies with different catalog types', async () => {
    const packageJson: PackageJson = {
      name: 'test-package',
      dependencies: {},
    }

    const dependencies: RawDep[] = [
      {
        name: 'eslint',
        specifier: '^8.0.0',
        catalogName: 'default',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
      },
      {
        name: 'vue',
        specifier: '^3.0.0',
        catalogName: 'frontend',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
      },
      {
        name: 'lodash',
        specifier: '^4.0.0',
        catalogName: 'utils',
        source: 'dependencies',
        catalog: false,
        catalogable: true,
      },
    ]

    const config = await setupTest(packageJson, dependencies)
    await addCommand(config)

    expect(packageJson.dependencies).toEqual({
      eslint: 'catalog:',
      vue: 'catalog:frontend',
      lodash: 'catalog:utils',
    })
  })

  it('should handle dev dependencies with default catalog', async () => {
    const packageJson: PackageJson = {
      name: 'test-package',
      devDependencies: {},
    }

    const dependencies: RawDep[] = [{
      name: 'vitest',
      specifier: '^1.0.0',
      catalogName: 'default',
      source: 'devDependencies',
      catalog: false,
      catalogable: true,
    }]

    const config = await setupTest(packageJson, dependencies, true)
    await addCommand(config)

    expect(packageJson.devDependencies).toEqual({
      vitest: 'catalog:',
    })
  })

  it('should handle non-catalog dependencies', async () => {
    const packageJson: PackageJson = {
      name: 'test-package',
      dependencies: {},
    }

    const dependencies: RawDep[] = [{
      name: 'some-package',
      specifier: '^2.0.0',
      source: 'dependencies',
      catalog: false,
      catalogable: false,
    } as RawDep]

    const config = await setupTest(packageJson, dependencies)
    await addCommand(config)

    expect(packageJson.dependencies).toEqual({
      'some-package': '^2.0.0',
    })
  })

  it('should move dependencies between dep types when adding', async () => {
    const packageJson: PackageJson = {
      name: 'test-package',
      dependencies: {},
      devDependencies: {
        eslint: '^7.0.0',
      },
    }

    const dependencies: RawDep[] = [{
      name: 'eslint',
      specifier: '^8.0.0',
      catalogName: 'default',
      source: 'dependencies',
      catalog: false,
      catalogable: true,
    }]

    const config = await setupTest(packageJson, dependencies)
    await addCommand(config)

    expect(packageJson.dependencies).toEqual({
      eslint: 'catalog:',
    })
    expect(packageJson.devDependencies).toEqual({})
  })
})
