import { describe, expect, it } from 'vitest'
import { cleanupPackageJSON } from '../../src/utils/package-json'

describe('cleanupPackageJSON', () => {
  it('removes empty dependency fields and keeps non-empty ones', () => {
    const cleaned = cleanupPackageJSON({
      name: 'app',
      dependencies: {
        react: '^18.3.1',
      },
      devDependencies: {},
      peerDependencies: {},
    })

    expect(cleaned.dependencies).toEqual({
      react: '^18.3.1',
    })
    expect(cleaned.devDependencies).toBeUndefined()
    expect(cleaned.peerDependencies).toBeUndefined()
  })
})
