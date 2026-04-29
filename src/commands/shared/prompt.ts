import type { RawDep } from '@/types'
import * as p from '@clack/prompts'
import {
  isCatalogSpecifier,
  parseCatalogSpecifier,
  toCatalogSpecifier,
} from '@/utils'
import { COMMAND_ERROR_CODES, createCommandError } from './error'

export async function promptAdjustCatalogs(dependencies: RawDep[]): Promise<void> {
  const selectedIndexes = await selectCatalogDependencies(dependencies)
  const defaultCatalogName = dependencies[selectedIndexes[0]].catalogName
  const input = await p.text({
    message: 'enter target catalog name',
    placeholder: defaultCatalogName,
  })

  if (p.isCancel(input))
    throw createCommandError(COMMAND_ERROR_CODES.ABORT)

  const catalogName = normalizeCatalogName(String(input))
  if (!catalogName)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'catalog name is required, aborting')

  for (const index of selectedIndexes)
    dependencies[index].catalogName = catalogName
}

async function selectCatalogDependencies(dependencies: RawDep[]): Promise<number[]> {
  if (dependencies.length === 1)
    return [0]

  const selected = await p.multiselect({
    message: 'select dependencies to move',
    options: dependencies.map((dep, index) => ({
      label: dep.name,
      value: index,
      hint: `${toCatalogSpecifier(dep.catalogName)} ${dep.specifier}`,
    })),
  })

  if (p.isCancel(selected))
    throw createCommandError(COMMAND_ERROR_CODES.ABORT)

  if (selected.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no dependencies selected, aborting')

  return selected
}

function normalizeCatalogName(input: string): string {
  const catalogName = input.trim()
  if (!isCatalogSpecifier(catalogName))
    return catalogName

  return parseCatalogSpecifier(catalogName)
}
