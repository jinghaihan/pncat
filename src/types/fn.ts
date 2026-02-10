export type DepFilter = (name: string, specifier: string) => boolean

export type HookFunction = () => Promise<void> | void
