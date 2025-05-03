import type { CatalogOptions } from '../types'
import process from 'node:process'
import * as p from '@clack/prompts'
import { execa } from 'execa'
import { ensureDep } from '../utils/ensure'

export async function addCommand(_options: CatalogOptions) {
  await ensureDep('@antfu/nip')
  await import('@antfu/nip')

  await execa('nip', process.argv.slice(3), {
    stdio: 'inherit',
  })

  p.log.success('add complete')
}
