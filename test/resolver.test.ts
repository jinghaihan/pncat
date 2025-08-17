import type { RawDep } from '../src/types'
import { expect, it } from 'vitest'
import { resolveConflict } from '../src/utils/resolver'
import { createDep } from './_utils'

it('should select the latest version', async () => {
  const dependencies = new Map<string, Map<string, RawDep[]>>()
  dependencies.set('vue', new Map())
  dependencies.get('vue')!.set(
    'frontend',
    [
      createDep<RawDep>('vue', '1.0.0'),
      createDep<RawDep>('vue', '3.0.0'),
      createDep<RawDep>('vue', '2.0.0'),
    ],
  )
  await resolveConflict(dependencies, { yes: true })
  expect(dependencies.get('vue')?.get('frontend')?.length).toBe(1)
  expect(dependencies.get('vue')?.get('frontend')?.[0].specifier).toBe('3.0.0')
})
