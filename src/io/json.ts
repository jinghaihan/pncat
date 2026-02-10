import { readFile, writeFile } from 'node:fs/promises'
import detect from 'detect-indent'

export async function detectIndentOfFile(filepath: string): Promise<string> {
  try {
    const content = await readFile(filepath, 'utf-8')
    return detect(content).indent || '  '
  }
  catch {
    return '  '
  }
}

export async function readJsonFile<T>(filepath: string): Promise<T> {
  const content = await readFile(filepath, 'utf-8')
  return JSON.parse(content) as T
}

export async function writeJsonFile(filepath: string, data: unknown): Promise<void> {
  const indent = await detectIndentOfFile(filepath)
  await writeFile(filepath, `${JSON.stringify(data, null, indent)}\n`, 'utf-8')
}
