import type { PackageMeta } from '@/types'
import { describe, expect, it } from 'vitest'
import { PACKAGE_MANAGERS } from '@/constants'
import { loadPackages } from '@/io'
import { createFixtureOptions, getFixturePath, getSnapshotPath } from '../_shared'

const FIXTURES_ROOT = getFixturePath().replaceAll('\\', '/')

describe('loadPackages', () => {
  for (const agent of PACKAGE_MANAGERS) {
    it(`scans ${agent} fixture directory and matches package snapshot`, async () => {
      const packages = await loadPackages(createFixtureOptions(agent))
      const snapshotPath = getSnapshotPath(`io-packages.${agent}.json`)
      await expect(`${JSON.stringify(normalizePackagePaths(packages), null, 2)}\n`).toMatchFileSnapshot(snapshotPath)
    })
  }
})

function normalizePackagePaths(packages: PackageMeta[]): unknown {
  return JSON.parse(JSON.stringify(packages, (_key, value) => {
    if (typeof value !== 'string')
      return value

    const normalized = value.replaceAll('\\', '/')
    if (!normalized.startsWith(`${FIXTURES_ROOT}/`))
      return value

    return `<fixtures>/${normalized.slice(FIXTURES_ROOT.length + 1)}`
  }))
}
