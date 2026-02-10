import { readFile, writeFile } from 'node:fs/promises'
import detect from 'detect-indent'

const DEFAULT_INDENT = '  '

export async function detectIndent(filepath: string): Promise<string> {
  try {
    const rawText = await readFile(filepath, 'utf-8')
    return detect(rawText).indent || DEFAULT_INDENT
  }
  catch {
    return DEFAULT_INDENT
  }
}

export async function readJsonFile<T = unknown>(filepath: string): Promise<T> {
  const rawText = await readFile(filepath, 'utf-8')
  return JSON.parse(rawText) as T
}

export async function writeJsonFile(filepath: string, data: unknown): Promise<void> {
  const indent = await detectIndent(filepath)
  await writeFile(filepath, `${JSON.stringify(data, null, indent)}\n`, 'utf-8')
}
