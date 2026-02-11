import * as p from '@clack/prompts'
import c from 'ansis'

export const COMMAND_ERROR_CODES = {
  ABORT: 'abort',
} as const

export const COMMAND_ERROR_MESSAGES: Record<CommandErrorCode, string> = {
  [COMMAND_ERROR_CODES.ABORT]: 'aborting',
}

export type CommandErrorCode = typeof COMMAND_ERROR_CODES[keyof typeof COMMAND_ERROR_CODES]

export interface CommandError extends Error {
  code: CommandErrorCode
}

export function createCommandError(code: CommandErrorCode, message?: string): CommandError {
  const error = new Error(message ?? COMMAND_ERROR_MESSAGES[code]) as CommandError
  error.name = 'CommandError'
  error.code = code
  return error
}

export function isCommandError(error: unknown): error is CommandError {
  const code = (error as { code?: unknown })?.code
  return error instanceof Error
    && typeof code === 'string'
    && Object.values(COMMAND_ERROR_CODES).includes(code as CommandErrorCode)
}

export function reportCommandError(error: unknown): void {
  if (isCommandError(error) && error.code === COMMAND_ERROR_CODES.ABORT) {
    p.outro(c.red(error.message || COMMAND_ERROR_MESSAGES[error.code]))
    return
  }
  console.error(error)
}
