import type { DetectResult } from 'package-manager-detector'
import { findUp } from 'find-up'
import { detect } from 'package-manager-detector'
import { describe, expect, it, vi } from 'vitest'
import { detectPackageManager } from '../../src/utils'

vi.mock('package-manager-detector', () => ({
  detect: vi.fn(),
}))

vi.mock('find-up', () => ({
  findUp: vi.fn(),
}))

const detectMock = vi.mocked(detect)
const findUpMock = vi.mocked(findUp)

describe('detectPackageManager', () => {
  it('returns detected package manager when detector reports a supported one', async () => {
    const result: DetectResult = { name: 'yarn', agent: 'yarn' }
    detectMock.mockResolvedValue(result)
    findUpMock.mockResolvedValue(undefined)

    await expect(detectPackageManager('/repo/packages/app')).resolves.toBe('yarn')
    expect(findUpMock).not.toHaveBeenCalled()
  })

  it('falls back to vlt when detector result is unsupported but vlt markers exist', async () => {
    const result: DetectResult = { name: 'npm', agent: 'npm' }
    detectMock.mockResolvedValue(result)
    findUpMock.mockResolvedValue('/repo/vlt.json')

    await expect(detectPackageManager('/repo/packages/app')).resolves.toBe('vlt')
    expect(findUpMock).toHaveBeenCalledWith(['vlt.json', 'vlt-lock.json'], { cwd: '/repo/packages/app' })
  })

  it('falls back to pnpm when neither detector nor vlt markers match', async () => {
    detectMock.mockResolvedValue(null)
    findUpMock.mockResolvedValue(undefined)

    await expect(detectPackageManager('/repo/packages/app')).resolves.toBe('pnpm')
  })
})
