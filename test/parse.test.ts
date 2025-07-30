import { expect, it } from 'vitest'
import { parseSpec } from '../src/utils/parse'

it('parseSpec', () => {
  expect(parseSpec('nip')).toEqual({ name: 'nip' })
  expect(parseSpec('ni@^1')).toEqual({ name: 'ni', specifier: '^1' })
  expect(parseSpec('@antfu/nip')).toEqual({ name: '@antfu/nip' })
  expect(parseSpec('@antfu/nip@latest')).toEqual({ name: '@antfu/nip', specifier: 'latest' })
  expect(parseSpec('@antfu/nip@workspace')).toEqual({ name: '@antfu/nip', specifier: 'workspace' })
})
