import type { CatalogOptions, PackageJsonMeta } from '@/types'
import * as p from '@clack/prompts'
import { COMMAND_ERROR_CODES, createCommandError } from './error'

interface SelectTargetProjectPackagesOptions extends Pick<CatalogOptions, 'yes'> {
  projectPackages: PackageJsonMeta[]
  targetPackages?: PackageJsonMeta[]
  currentPackagePath: string
  promptMessage: string
}

export async function selectTargetProjectPackages(
  options: SelectTargetProjectPackagesOptions,
): Promise<PackageJsonMeta[]> {
  const {
    projectPackages,
    targetPackages = projectPackages,
    currentPackagePath,
    promptMessage,
    yes = false,
  } = options

  if (targetPackages.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no matching package.json found, aborting')

  const defaultTargetPackage = findDefaultTargetPackage(targetPackages, currentPackagePath)
  const isMonorepo = projectPackages.length > 1
  const isOnlyAndCurrent = targetPackages.length === 1 && defaultTargetPackage.filepath === currentPackagePath
  if (!isMonorepo || yes || isOnlyAndCurrent)
    return [defaultTargetPackage]

  const selected = await p.multiselect({
    message: promptMessage,
    options: targetPackages.map(pkg => ({
      label: pkg.name,
      value: pkg.filepath,
      hint: pkg.relative,
    })),
    initialValues: [defaultTargetPackage.filepath],
  })

  if (!selected || p.isCancel(selected))
    throw createCommandError(COMMAND_ERROR_CODES.ABORT)

  if (selected.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no package selected, aborting')

  const selectedPackages = targetPackages.filter(pkg => selected.includes(pkg.filepath))
  if (selectedPackages.length === 0)
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'no matching package selected, aborting')

  return selectedPackages
}

function findDefaultTargetPackage(
  targetPackages: PackageJsonMeta[],
  currentPackagePath: string,
): PackageJsonMeta {
  return targetPackages.find(pkg => pkg.filepath === currentPackagePath) || targetPackages[0]
}
