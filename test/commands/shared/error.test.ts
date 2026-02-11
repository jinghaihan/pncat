import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMMAND_ERROR_CODES,
  COMMAND_ERROR_MESSAGES,
  createCommandError,
  isCommandError,
  reportCommandError,
} from '@/commands/shared'

vi.mock('@clack/prompts', () => ({
  outro: vi.fn(),
}))

describe('createCommandError', () => {
  it('creates command error with default message from code map', () => {
    const error = createCommandError(COMMAND_ERROR_CODES.ABORT)

    expect(error.code).toBe(COMMAND_ERROR_CODES.ABORT)
    expect(error.message).toBe(COMMAND_ERROR_MESSAGES[COMMAND_ERROR_CODES.ABORT])
    expect(error.name).toBe('CommandError')
  })

  it('uses custom message when provided', () => {
    const error = createCommandError(COMMAND_ERROR_CODES.NOT_FOUND, 'missing workspace')
    expect(error.message).toBe('missing workspace')
  })
})

describe('isCommandError', () => {
  it('returns true for command errors', () => {
    expect(isCommandError(createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT))).toBe(true)
  })

  it('returns false for plain errors and non-errors', () => {
    expect(isCommandError(new Error('oops'))).toBe(false)
    expect(isCommandError('oops')).toBe(false)
  })
})

describe('reportCommandError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prints command error through clack outro', () => {
    const error = createCommandError(COMMAND_ERROR_CODES.ABORT)

    reportCommandError(error)

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('aborting'))
  })

  it('prints unknown errors through console.error', () => {
    const error = new Error('unknown')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    reportCommandError(error)

    expect(consoleSpy).toHaveBeenCalledWith(error)
    consoleSpy.mockRestore()
  })
})
