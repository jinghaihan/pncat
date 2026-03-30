import type { UserConfig } from 'tsdown'

const semverAliasEntries = [
  ['semver/functions/clean', 'semver-es/functions/clean'],
  ['semver/functions/satisfies', 'semver-es/functions/satisfies'],
  ['semver/functions/valid', 'semver-es/functions/valid'],
  ['semver/ranges/valid', 'semver-es/ranges/valid'],
  ['semver', 'semver-es'],
] as const

export function semverAliasPlugin(): UserConfig['plugins'] {
  return {
    name: 'semver-alias',
    async resolveId(this, source, importer, options) {
      const replacement = replaceSemverAlias(source)
      if (!replacement)
        return null

      return await this.resolve(replacement, importer, {
        ...options,
        skipSelf: true,
      })
    },
  }
}

function replaceSemverAlias(source: string) {
  for (const [find, replacement] of semverAliasEntries) {
    if (source === find)
      return replacement

    if (source.startsWith(`${find}/`))
      return `${replacement}${source.slice(find.length)}`
  }

  return null
}
