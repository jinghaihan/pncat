export function getDepSource(isDev: boolean = false, isOptional: boolean = false, isPeer: boolean = false) {
  return isDev
    ? 'devDependencies'
    : isOptional
      ? 'optionalDependencies'
      : isPeer ? 'peerDependencies' : 'dependencies'
}
