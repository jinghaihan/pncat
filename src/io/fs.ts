import type { PackageJson } from '../types'
import { readFile, writeFile } from 'node:fs/promises'
import detect from 'detect-indent'

export async function detectIndent(filepath: string) {
  const content = await readFile(filepath, 'utf-8')
  return detect(content).indent || '  '
}

export async function readJSON(filepath: string) {
  return JSON.parse(await readFile(filepath, 'utf-8'))
}

export async function writeJSON(filepath: string, data: PackageJson) {
  const fileIndent = await detectIndent(filepath)
  return await writeFile(filepath, `${JSON.stringify(data, null, fileIndent)}\n`, 'utf-8')
}
