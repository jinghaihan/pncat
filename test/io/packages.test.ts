import { describe, expect, it } from 'vitest'
import { PACKAGE_MANAGERS } from '@/constants'
import { loadPackages } from '@/io'
import { createFixtureOptions, getSnapshotPath } from '../_shared'

describe('loadPackages', () => {
  for (const agent of PACKAGE_MANAGERS) {
    it(`scans ${agent} fixture directory and matches package snapshot`, async () => {
      const packages = await loadPackages(createFixtureOptions(agent))
      const snapshotPath = getSnapshotPath(`io-packages.${agent}.json`)
      await expect(`${JSON.stringify(packages, null, 2)}\n`).toMatchFileSnapshot(snapshotPath)
    })
  }
})
