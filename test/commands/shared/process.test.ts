import * as p from '@clack/prompts'
import { resolveCommand } from 'package-manager-detector'
import { x } from 'tinyexec'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseCommandOptions,
  runAgentInstall,
  runAgentRemove,
  runHooks,
} from '@/commands/shared'
import { createFixtureOptions } from '../../_shared'

vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('package-manager-detector', () => ({
  resolveCommand: vi.fn(),
}))

vi.mock('tinyexec', () => ({
  x: vi.fn(async () => ({ exitCode: 0 })),
}))

const resolveCommandMock = vi.mocked(resolveCommand)
const xMock = vi.mocked(x)

describe('parseCommandOptions', () => {
  it('parses dependency args and save flag aliases', () => {
    const result = parseCommandOptions(['react', 'vite', '-D', '--save-exact', '-r'], createFixtureOptions('pnpm'))

    expect(result).toEqual({
      deps: ['react', 'vite'],
      isRecursive: true,
      isDev: true,
      isOptional: false,
      isPeer: false,
      isExact: true,
    })
  })

  it('prefers save-prod over save-dev/save-peer/save-optional', () => {
    const result = parseCommandOptions(['react', '--save-prod', '--save-dev', '--save-peer', '--save-optional'], createFixtureOptions('pnpm'))

    expect(result.isDev).toBe(false)
    expect(result.isPeer).toBe(false)
    expect(result.isOptional).toBe(false)
  })

  it('supports dependency list after -- separator', () => {
    const result = parseCommandOptions(['--save-dev', '--', '@scope/pkg', 'vitest'], createFixtureOptions('pnpm'))

    expect(result.deps).toEqual(['@scope/pkg', 'vitest'])
    expect(result.isDev).toBe(true)
  })

  it('skips long options with explicit values while collecting dependencies', () => {
    const result = parseCommandOptions(['--tag', 'next', 'react'], createFixtureOptions('pnpm'))
    expect(result.deps).toEqual(['react'])
  })

  it('skips short options with explicit values while collecting dependencies', () => {
    const result = parseCommandOptions(['-C', 'packages/app', 'react'], createFixtureOptions('pnpm'))
    expect(result.deps).toEqual(['react'])
  })

  it('handles short options without values when followed by another flag', () => {
    const result = parseCommandOptions(['-C', '--save-dev', 'react'], createFixtureOptions('pnpm'))
    expect(result.deps).toEqual(['react'])
    expect(result.isDev).toBe(true)
  })

  it('ignores --no-* boolean style flags while parsing dependencies', () => {
    const result = parseCommandOptions(['--no-frozen-lockfile', 'react'], createFixtureOptions('pnpm'))
    expect(result.deps).toEqual(['react'])
  })
})

describe('runAgentInstall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses resolved install command when detector provides one', async () => {
    resolveCommandMock.mockReturnValue({
      command: 'pnpm',
      args: ['install'],
    } as ReturnType<typeof resolveCommand>)

    await runAgentInstall({
      agent: 'pnpm',
      cwd: '/repo',
      silent: true,
    })

    expect(xMock).toHaveBeenCalledWith('pnpm', ['install'], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
      },
    })
  })

  it('falls back to direct install command when detector returns undefined', async () => {
    resolveCommandMock.mockReturnValue(null)

    await runAgentInstall({
      agent: 'pnpm',
      cwd: '/repo',
      silent: true,
    })

    expect(xMock).toHaveBeenCalledWith('pnpm', ['install'], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
      },
    })
  })

  it('falls back to direct install command when detector throws', async () => {
    resolveCommandMock.mockImplementation(() => {
      throw new Error('resolver failed')
    })

    await runAgentInstall({
      agent: 'pnpm',
      cwd: '/repo',
      silent: true,
    })

    expect(xMock).toHaveBeenCalledWith('pnpm', ['install'], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
      },
    })
  })
})

describe('runAgentRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses resolved uninstall command and passes recursive flag', async () => {
    resolveCommandMock.mockReturnValue({
      command: 'pnpm',
      args: ['remove', 'react', '--recursive'],
    } as ReturnType<typeof resolveCommand>)

    await runAgentRemove(['react'], {
      agent: 'pnpm',
      cwd: '/repo',
      recursive: true,
    })

    expect(xMock).toHaveBeenCalledWith('pnpm', ['remove', 'react', '--recursive'], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
      },
    })
  })

  it('does nothing when no dependencies are provided', async () => {
    await runAgentRemove([], {
      agent: 'pnpm',
      cwd: '/repo',
    })

    expect(xMock).not.toHaveBeenCalled()
  })

  it('falls back to direct remove command when detector returns undefined', async () => {
    resolveCommandMock.mockReturnValue(null)

    await runAgentRemove(['react'], {
      agent: 'pnpm',
      cwd: '/repo',
      recursive: false,
    })

    expect(xMock).toHaveBeenCalledWith('pnpm', ['remove', 'react'], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
      },
    })
  })

  it('falls back to direct remove command when detector throws', async () => {
    resolveCommandMock.mockImplementation(() => {
      throw new Error('resolver failed')
    })

    await runAgentRemove(['react'], {
      agent: 'pnpm',
      cwd: '/repo',
      recursive: true,
    })

    expect(xMock).toHaveBeenCalledWith('pnpm', ['remove', 'react', '--recursive'], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
      },
    })
  })
})

describe('runHooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs string hook commands in shell mode', async () => {
    await runHooks('eslint --fix', { cwd: '/repo' })

    expect(xMock).toHaveBeenCalledWith('eslint --fix', [], {
      nodeOptions: {
        cwd: '/repo',
        stdio: 'inherit',
        shell: true,
      },
    })
  })

  it('runs function hooks', async () => {
    const hook = vi.fn()
    await runHooks(hook)
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('logs warning when hook execution fails', async () => {
    xMock.mockRejectedValueOnce(new Error('failed'))

    await runHooks('eslint --fix', { cwd: '/repo' })

    expect(p.log.warn).toHaveBeenCalledWith('hook failed: eslint --fix')
  })
})
