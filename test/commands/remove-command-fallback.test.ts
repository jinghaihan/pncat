import process from 'node:process'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeCommand } from '@/commands/remove'
import { COMMAND_ERROR_CODES } from '@/commands/shared'
import * as shared from '@/commands/shared'
import { createFixtureOptions } from '../_shared'

const workspaceState = vi.hoisted(() => ({
  current: null as any,
}))

vi.mock('@/workspace-manager', () => {
  return {
    WorkspaceManager: class WorkspaceManagerMock {
      constructor() {
        return workspaceState.current
      }
    },
  }
})

vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
}))

vi.mock('@/commands/shared', async () => {
  const actual = await vi.importActual<typeof import('@/commands/shared')>('@/commands/shared')
  return {
    ...actual,
    runAgentRemove: vi.fn(),
  }
})

const runAgentRemoveMock = vi.mocked(shared.runAgentRemove)

describe('removeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    runAgentRemoveMock.mockResolvedValue(undefined)
    workspaceState.current = {
      getCwd: () => '/repo',
      catalog: {
        findWorkspaceFile: vi.fn(async () => ''),
      },
    }
  })

  it('falls back to package manager remove when workspace file is unavailable', async () => {
    process.argv = ['node', 'pncat', 'remove', 'react', '-r']

    await removeCommand(createFixtureOptions('pnpm', {
      install: false,
      verbose: false,
    }))

    expect(runAgentRemoveMock).toHaveBeenCalledWith(['react'], {
      cwd: '/repo',
      agent: 'pnpm',
      recursive: true,
    })
    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('remove complete'))
  })

  it('throws when fallback path receives no dependency names after parsing', async () => {
    process.argv = ['node', 'pncat', 'remove', '-r']

    await expect(removeCommand(createFixtureOptions('pnpm', {
      install: false,
      verbose: false,
    }))).rejects.toMatchObject({
      code: COMMAND_ERROR_CODES.INVALID_INPUT,
    })
  })
})
