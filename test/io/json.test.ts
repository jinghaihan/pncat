import { readFile, writeFile } from 'node:fs/promises'
import detect from 'detect-indent'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectIndent, readJsonFile, writeJsonFile } from '@/io'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

vi.mock('detect-indent', () => ({
  default: vi.fn(),
}))

const readFileMock = vi.mocked(readFile)
const writeFileMock = vi.mocked(writeFile)
const detectMock = vi.mocked(detect)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('detectIndent', () => {
  it('returns detected indentation from file content', async () => {
    readFileMock.mockResolvedValue('{\n\t"a": 1\n}')
    detectMock.mockReturnValue({
      amount: 1,
      type: 'tab',
      indent: '\t',
    })

    await expect(detectIndent('/repo/package.json')).resolves.toBe('\t')
  })

  it('falls back to two spaces when detect-indent returns empty indent', async () => {
    readFileMock.mockResolvedValue('{"a":1}')
    detectMock.mockReturnValue({
      amount: 0,
      type: undefined,
      indent: '',
    })

    await expect(detectIndent('/repo/package.json')).resolves.toBe('  ')
  })

  it('falls back to two spaces when reading file fails', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'))
    await expect(detectIndent('/repo/missing.json')).resolves.toBe('  ')
  })
})

describe('readJsonFile', () => {
  it('parses JSON text into object', async () => {
    readFileMock.mockResolvedValue('{"name":"pncat","private":true}')
    await expect(readJsonFile('/repo/package.json'))
      .resolves
      .toEqual({ name: 'pncat', private: true })
  })
})

describe('writeJsonFile', () => {
  it('writes prettified JSON using detected indent', async () => {
    readFileMock.mockResolvedValue('{\n\t"name": "old"\n}')
    detectMock.mockReturnValue({
      amount: 1,
      type: 'tab',
      indent: '\t',
    })

    await writeJsonFile('/repo/package.json', {
      name: 'pncat',
      private: true,
    })

    expect(writeFileMock).toHaveBeenCalledWith(
      '/repo/package.json',
      '{\n\t"name": "pncat",\n\t"private": true\n}\n',
      'utf-8',
    )
  })
})
