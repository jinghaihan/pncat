import type { ParsedSpec } from '../types'

export function parseSpec(spec: string): ParsedSpec {
  let name: string | undefined
  let specifier: string | undefined
  const parts = spec.split(/@/g)
  if (parts[0] === '') { // @scope/name
    name = parts.slice(0, 2).join('@')
    specifier = parts[2]
  }
  else {
    name = parts[0]
    specifier = parts[1]
  }
  return { name, specifier }
}
