import { execa } from 'execa'
import { resolve } from 'pathe'
import { expect, it } from 'vitest'

it('pncat cli should just works', async () => {
  const binPath = resolve(__dirname, '../bin/pncat.mjs')

  const proc = await execa(process.execPath, [binPath])

  expect(proc.stderr).toBe('')
})
