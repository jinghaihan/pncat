import { getLatestVersion as getNpmLatestVersion } from 'get-npm-meta'

export async function getLatestVersion(name: string): Promise<string | null> {
  const { version } = await getNpmLatestVersion(name)
  return version
}
