export const COMPLEX_SPECIFIER_RANGE_TYPES = [
  '||',
  '-',
  '>=',
  '<=',
  '>',
  '<',
] as const

export const SPECIFIER_RANGE_TYPES = [
  ...COMPLEX_SPECIFIER_RANGE_TYPES,
  'x',
  '*',
  'pre-release',
] as const
