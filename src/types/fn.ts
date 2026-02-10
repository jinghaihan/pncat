export type DepFilter = (name: string, specifier: string) => boolean

export type HookFunction = () => Promise<void> | void

export interface ParsedSpec {
  name: string
  specifier?: string
  catalogName?: string
  specifierSource?: 'user' | 'catalog' | 'workspace' | 'npm'
}

export interface DependencyEntry {
  name: string
  specifier: string
  parents: string[]
}
