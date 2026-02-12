import { describe, expect, it } from 'vitest'
import { loadPackageJSON } from '@/io'
import { createFixtureOptions, createFixtureScenarioOptions, getFixturePath } from '../_shared'

describe('loadPackageJSON', () => {
  it('uses package name and version from package.json when valid', async () => {
    const packages = await loadPackageJSON(
      'package.json',
      createFixtureOptions('pnpm', { cwd: getFixturePath('pnpm') }),
      () => true,
    )

    expect(packages[0].name).toBe('fixture-pnpm')
    expect(packages[0].version).toBe('0.0.0')
  })

  it('falls back to relative path name when package name is missing', async () => {
    const packages = await loadPackageJSON(
      'package.json',
      createFixtureScenarioOptions('unnamed-package'),
      () => true,
    )

    expect(packages[0].name).toBe('package.json')
    expect(packages[0].version).toBeUndefined()
  })
})
