import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VltCatalog } from '../../src/catalog-handler/vlt-workspace'
import { readJsonFile } from '../../src/io'
import { createFixtureOptions } from '../_shared'

vi.mock('../../src/io', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/io')>()
  return {
    ...actual,
    readJsonFile: vi.fn(),
  }
})

const readJsonFileMock = vi.mocked(readJsonFile)

describe('loadWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when relative path is not vlt workspace file', async () => {
    const workspace = await VltCatalog.loadWorkspace('package.json', createFixtureOptions('vlt'), () => true)
    expect(workspace).toBeNull()
  })

  it('loads only default catalog when named catalogs are missing', async () => {
    const workspace = {
      catalog: {
        svelte: '^5.0.0',
      },
    }
    readJsonFileMock.mockResolvedValue(workspace)

    const loaded = await VltCatalog.loadWorkspace('vlt.json', createFixtureOptions('vlt'), () => true)
    expect(loaded?.map(item => item.name)).toEqual(['vlt-catalog:default'])
  })

  it('loads only named catalogs when default catalog is missing', async () => {
    const workspace = {
      catalogs: {
        build: {
          vite: '^7.0.0',
        },
      },
    }
    readJsonFileMock.mockResolvedValue(workspace)

    const loaded = await VltCatalog.loadWorkspace('vlt.json', createFixtureOptions('vlt'), () => true)
    expect(loaded?.map(item => item.name)).toEqual(['vlt-catalog:build'])
  })
})
