import type { CatalogOptions, PackageJson, PackageJsonMeta } from '@/types'
import type { WorkspaceManager } from '@/workspace-manager'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import * as p from '@clack/prompts'
import c from 'ansis'
import { join } from 'pathe'
import tildify from 'tildify'
import { PACKAGE_MANAGER_CONFIG } from '@/constants'
import { detectWorkspaceRoot, readJsonFile, writeJsonFile } from '@/io'
import { cleanupPackageJSON } from '@/utils'
import { diffHighlight } from './diff'
import { COMMAND_ERROR_CODES, createCommandError } from './error'
import { runAgentInstall, runHooks } from './process'

export interface ConfirmationOptions extends Pick<CatalogOptions, 'yes' | 'verbose'> {
  workspace: WorkspaceManager
  updatedPackages?: Record<string, PackageJsonMeta>
  bailout?: boolean
  confirmMessage?: string
  completeMessage?: string
  showDiff?: boolean
}

export async function readWorkspacePackageJSON(workspace: WorkspaceManager): Promise<{
  pkgPath: string
  pkgName: string
  pkgJson: PackageJson
}> {
  const pkgPath = join(workspace.getCwd(), 'package.json')
  if (!existsSync(pkgPath))
    throw createCommandError(COMMAND_ERROR_CODES.NOT_FOUND, 'no package.json found, aborting')

  const pkgJson = await readJsonFile<PackageJson>(pkgPath)
  if (typeof pkgJson.name !== 'string')
    throw createCommandError(COMMAND_ERROR_CODES.INVALID_INPUT, 'package.json is missing name, aborting')

  return { pkgPath, pkgName: pkgJson.name, pkgJson }
}

export async function ensureWorkspaceFile(workspace: WorkspaceManager): Promise<void> {
  const options = workspace.getOptions()
  const agent = options.agent || 'pnpm'

  // bun workspace discovery is catalog-aware and can be absent even when package.json exists.
  if (agent === 'bun') {
    await workspace.catalog.ensureWorkspace()
    return
  }

  const filepath = await workspace.catalog.findWorkspaceFile()
  if (!filepath) {
    const { filename, defaultContent } = PACKAGE_MANAGER_CONFIG[agent]
    const root = await detectWorkspaceRoot(agent, workspace.getCwd())
    p.log.warn(c.yellow(`no ${filename} found`))

    if (!options.yes) {
      const confirmed = await p.confirm({
        message: `do you want to create it under project root ${c.dim(root)} ?`,
      })

      if (p.isCancel(confirmed) || !confirmed)
        throw createCommandError(COMMAND_ERROR_CODES.ABORT)
    }

    await writeFile(join(root, filename), defaultContent, 'utf-8')
  }

  await workspace.catalog.ensureWorkspace()
}

export async function confirmWorkspaceChanges(
  modifier: () => Promise<void>,
  options: ConfirmationOptions,
): Promise<'applied' | 'noop'> {
  const {
    workspace,
    updatedPackages,
    yes = false,
    verbose = false,
    bailout = true,
    confirmMessage = 'continue?',
    completeMessage,
    showDiff = true,
  } = options

  const catalogOptions = workspace.getOptions()
  const filename = PACKAGE_MANAGER_CONFIG[catalogOptions.agent || 'pnpm'].filename
  const rawContent = await workspace.catalog.toString()

  await modifier()

  if (catalogOptions.agent === 'pnpm')
    await workspace.catalog.updateWorkspaceOverrides?.()

  const nextContent = await workspace.catalog.toString()
  if (rawContent === nextContent) {
    if (bailout)
      p.outro(c.yellow(`no changes to ${filename}`))
    else
      p.log.info(c.green(`no changes to ${filename}`))

    return 'noop'
  }

  const workspacePath = await workspace.catalog.getWorkspacePath()
  const diff = diffHighlight(rawContent, nextContent, { verbose })

  if (showDiff && diff) {
    p.note(c.reset(diff), c.dim(tildify(workspacePath)))

    if (!yes) {
      const confirmed = await p.confirm({ message: confirmMessage })
      if (p.isCancel(confirmed) || !confirmed)
        throw createCommandError(COMMAND_ERROR_CODES.ABORT)
    }
  }

  if (updatedPackages)
    await writePackageJSONs(updatedPackages)

  if (diff) {
    p.log.info(`writing ${filename}`)
    await workspace.catalog.writeWorkspace()
  }

  if (catalogOptions.postRun)
    await runHooks(catalogOptions.postRun, { cwd: workspace.getCwd() })

  if (completeMessage) {
    if (catalogOptions.install) {
      p.log.info(c.green(completeMessage))
      await runAgentInstall({
        cwd: workspace.getCwd(),
        agent: catalogOptions.agent,
      })
    }
    else {
      p.outro(c.green(completeMessage))
    }
  }

  return 'applied'
}

async function writePackageJSONs(updatedPackages: Record<string, PackageJsonMeta>): Promise<void> {
  if (Object.keys(updatedPackages).length === 0)
    return

  p.log.info('writing package.json')
  await Promise.all(
    Object.values(updatedPackages).map(pkg => writeJsonFile(pkg.filepath, cleanupPackageJSON(pkg.raw))),
  )
}
