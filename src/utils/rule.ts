import type { CatalogOptions, RawDep } from '../types'
import { DEP_TYPE_GROUP_NAME_MAP } from '../constants'

export function getDepCatalogName(dep: RawDep, options: CatalogOptions) {
  for (const rule of options.catalogRules ?? []) {
    const { name, match } = rule

    if (Array.isArray(match)) {
      if (match.some(m => (typeof m === 'string' ? dep.name === m : m.test(dep.name))))
        return name
    }
    else if (typeof match === 'string' && dep.name === match) {
      return name
    }
    else if (match instanceof RegExp && match.test(dep.name)) {
      return name
    }
  }

  return DEP_TYPE_GROUP_NAME_MAP[dep.source] || 'default'
}
