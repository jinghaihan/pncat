import type { CatalogOptions, PackageJson, PackageJsonMeta } from '../types'
import type { Workspace } from '../workspace-manager'
import { existsSync } from 'node:fs'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { basename, join } from 'pathe'
import tildify from 'tildify'
import { DEPS_FIELDS, WORKSPACE_META } from '../constants'
import { readJSON, writeJSON } from '../io/packages'
import { runHooks, runInstallCommand } from './process'
import { diffYAML } from './yaml'

export interface ConfirmationOptions extends Pick<CatalogOptions, 'yes' | 'verbose'> {
  workspace: Workspace
  updatedPackages?: Record<string, PackageJsonMeta>
  bailout?: boolean
  confirmMessage?: string
  completeMessage?: string
}

export async function confirmWorkspaceChanges(modifier: () => Promise<void>, options: ConfirmationOptions) {
  const {
    workspace,
    updatedPackages,
    yes = false,
    verbose = false,
    bailout = true,
    confirmMessage = 'continue?',
    completeMessage,
  } = options ?? {}

  const catalogOptions = workspace.getOptions()
  const workspaceFile = WORKSPACE_META[catalogOptions.packageManager || 'pnpm'].workspaceFile

  const rawContent = await workspace.catalog.toString()

  await modifier()
  // update pnpm-workspace.yaml overrides
  if (catalogOptions.packageManager === 'pnpm') {
    const packages = await workspace.loadPackages()
    await workspace.catalog.updateWorkspaceOverrides?.(packages)
  }

  const content = await workspace.catalog.toString()

  if (rawContent === content) {
    if (bailout) {
      p.outro(c.yellow(`no changes to ${workspaceFile}`))
      process.exit(0)
    }
    else {
      p.log.info(c.green(`no changes to ${workspaceFile}`))
    }
  }

  const diff = diffYAML(rawContent, content, { verbose })

  if (diff) {
    const filepath = await workspace.catalog.getWorkspacePath()
    p.note(c.reset(diff), c.dim(tildify(filepath)))
    if (!yes) {
      const result = await p.confirm({ message: confirmMessage })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }
    p.log.info(`writing ${basename(filepath)}`)
    await workspace.catalog.writeWorkspace()
  }

  if (updatedPackages)
    await writePackageJSONs(updatedPackages!)

  if (catalogOptions.postRun) {
    await runHooks(catalogOptions.postRun, { cwd: workspace.getCwd() })
  }

  if (completeMessage) {
    if (catalogOptions.install) {
      p.log.info(c.green(completeMessage))
      await runInstallCommand({
        cwd: workspace.getCwd(),
        packageManager: catalogOptions.packageManager,
      })
    }
    else {
      p.outro(c.green(completeMessage))
    }
  }
}

export async function readPackageJSON() {
  const pkgPath = join(process.cwd(), 'package.json')
  if (!existsSync(pkgPath)) {
    p.outro(c.red('no package.json found, aborting'))
    process.exit(1)
  }

  const pkgJson = await readJSON(pkgPath)
  if (typeof pkgJson.name !== 'string') {
    p.outro(c.red('package.json is missing name, aborting'))
    process.exit(1)
  }

  return { pkgPath, pkgJson }
}

export async function writePackageJSONs(updatedPackages: Record<string, PackageJsonMeta>): Promise<void> {
  if (Object.keys(updatedPackages).length === 0)
    return

  p.log.info('writing package.json')
  await Promise.all(
    Object.values(updatedPackages).map(pkg => writeJSON(pkg.filepath, cleanupPackageJSON(pkg.raw))),
  )
}

export function cleanupPackageJSON(pkgJson: PackageJson) {
  for (const field of DEPS_FIELDS) {
    const deps = pkgJson[field]
    if (!deps)
      continue

    if (Object.keys(deps).length === 0)
      delete pkgJson[field]
  }
  return pkgJson
}
