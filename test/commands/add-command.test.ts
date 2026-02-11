import type { CatalogOptions, PackageJson, PackageJsonMeta } from '../../src/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCommand } from '../../src/commands/add'
import {
  COMMAND_ERROR_CODES,
  confirmWorkspaceChanges,
  ensureWorkspaceFile,
  readWorkspacePackageJSON,
} from '../../src/commands/shared'
import { createFixtureOptions } from '../_shared'

vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}))

vi.mock('../../src/commands/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/commands/shared')>()
  return {
    ...actual,
    ensureWorkspaceFile: vi.fn(),
    readWorkspacePackageJSON: vi.fn(),
    confirmWorkspaceChanges: vi.fn(async (modifier: () => Promise<void>) => {
      await modifier()
      return 'applied' as const
    }),
  }
})

interface AddWorkspaceLike {
  loadPackages: () => Promise<unknown[]>
  getCatalogIndex: () => Promise<Map<string, { catalogName: string, specifier: string }[]>>
  getProjectPackages: () => PackageJsonMeta[]
  catalog: {
    setPackage: (catalogName: string, depName: string, specifier: string) => Promise<void>
  }
}

let workspaceInstance: AddWorkspaceLike

vi.mock('../../src/workspace-manager', () => ({
  WorkspaceManager: class {
    constructor() {
      return workspaceInstance
    }
  },
}))

const ensureWorkspaceFileMock = vi.mocked(ensureWorkspaceFile)
const readWorkspacePackageJSONMock = vi.mocked(readWorkspacePackageJSON)
const confirmWorkspaceChangesMock = vi.mocked(confirmWorkspaceChanges)

function createWorkspace(): AddWorkspaceLike {
  const appPackage: PackageJsonMeta = {
    type: 'package.json',
    name: 'app',
    private: true,
    version: '1.0.0',
    filepath: '/repo/package.json',
    relative: 'package.json',
    raw: { name: 'app' },
    deps: [],
  }

  return {
    loadPackages: vi.fn(async () => []),
    getCatalogIndex: vi.fn(async () => new Map()),
    getProjectPackages: vi.fn(() => [appPackage]),
    catalog: {
      setPackage: vi.fn(async () => {}),
    },
  }
}

describe('addCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceInstance = createWorkspace()
    ensureWorkspaceFileMock.mockResolvedValue(undefined)
    process.argv = ['node', 'pncat', 'add', 'react@^18.3.1']
  })

  it('throws when no dependencies are provided', async () => {
    process.argv = ['node', 'pncat', 'add']
    await expect(addCommand(createFixtureOptions('pnpm'))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })

  it('updates package json deps and writes catalog entry', async () => {
    const pkgJson: PackageJson = {
      name: 'app',
      version: '1.0.0',
      dependencies: {
        react: '^17.0.0',
      },
      devDependencies: {},
      peerDependencies: {
        react: '^17.0.0',
      },
      optionalDependencies: {
        react: '^17.0.0',
      },
    }
    readWorkspacePackageJSONMock.mockResolvedValue({
      pkgPath: '/repo/package.json',
      pkgName: 'app',
      pkgJson,
    })

    process.argv = ['node', 'pncat', 'add', 'react@^18.3.1', '-D']
    const options: CatalogOptions = createFixtureOptions('pnpm', { yes: true })
    await addCommand(options)

    expect(ensureWorkspaceFileMock).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.loadPackages).toHaveBeenCalledTimes(2)
    expect(pkgJson.dependencies?.react).toBeUndefined()
    expect(pkgJson.peerDependencies?.react).toBe('^17.0.0')
    expect(pkgJson.optionalDependencies?.react).toBe('^17.0.0')
    expect(pkgJson.devDependencies?.react).toBe('catalog:dev')

    expect(confirmWorkspaceChangesMock).toHaveBeenCalledTimes(1)
    expect(workspaceInstance.catalog.setPackage).toHaveBeenCalledWith('dev', 'react', '^18.3.1')
  })
})
