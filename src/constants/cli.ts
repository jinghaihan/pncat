import type { RangeMode } from '../types'

export const MODE_CHOICES = [
  'init',
  'detect',
  'migrate',
  'add',
  'remove',
  'clean',
  'revert',
  'fix',
] as const

export const MODE_ALIASES: Partial<Record<RangeMode, string[]>> = {
  init: ['create', 'setup', 'config', 'conf'],
  detect: ['scan', 'check', 'find', 'd'],
  migrate: ['move', 'mv', 'mig', 'm'],
  add: ['install', 'in', 'i'],
  remove: ['uninstall', 'rm', 'r', 'un', 'u'],
  clean: ['prune', 'cl', 'c'],
  revert: ['restore', 'undo', 'rev'],
  fix: ['f'],
}
