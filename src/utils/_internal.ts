export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function cloneDeep<T>(data: T): T {
  return structuredClone(data)
}

export function getValueByPath(input: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isObject(current))
      return undefined
    return current[key]
  }, input)
}
