import type { CatalogOptions } from '../types'
import process from 'node:process'
import { resolve } from 'pathe'

export function getCwd(options: CatalogOptions): string {
  return resolve(options.cwd || process.cwd())
}
