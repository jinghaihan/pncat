import type { PnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import type { CatalogManager } from '../catalog-manager'
import type { CatalogOptions, PackageJson, PackageJsonMeta, RawDep } from '../types'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { basename, join } from 'pathe'
import { DEPS_FIELDS, WORKSPACE_FILES } from '../constants'
import { readJSON, writeJSON } from '../io/packages'
import { updatePnpmWorkspaceOverrides } from './overrides'
import { runHooks, runInstallCommand } from './process'
import { diffYAML } from './yaml'

export interface ConfirmationOptions extends Pick<CatalogOptions, 'yes' | 'verbose'> {
  catalogManager: CatalogManager
  workspaceYaml: PnpmWorkspaceYaml
  workspaceYamlPath: string
  updatedPackages?: Record<string, PackageJsonMeta>
  bailout?: boolean
  confirmMessage?: string
  completeMessage?: string
}

export async function confirmWorkspaceChanges(modifier: () => Promise<void>, options: ConfirmationOptions) {
  const {
    catalogManager,
    workspaceYaml,
    workspaceYamlPath,
    updatedPackages,
    yes = false,
    verbose = false,
    bailout = true,
    confirmMessage = 'continue?',
    completeMessage,
  } = options ?? {}

  const commandOptions = catalogManager.getOptions()
  const workspaceFile = WORKSPACE_FILES[commandOptions.packageManager || 'pnpm']

  const rawContent = workspaceYaml.toString()

  await modifier()
  // update pnpm-workspace.yaml overrides
  if (commandOptions.packageManager === 'pnpm')
    await updatePnpmWorkspaceOverrides(workspaceYaml, catalogManager)

  const content = workspaceYaml.toString()

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
    p.note(c.reset(diff), c.dim(workspaceYamlPath))
    if (!yes) {
      const result = await p.confirm({ message: confirmMessage })
      if (!result || p.isCancel(result)) {
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }
    await writeWorkspaceYaml(workspaceYamlPath, content)
  }

  if (updatedPackages)
    await writePackageJSONs(updatedPackages!)

  if (commandOptions.postRun) {
    await runHooks(commandOptions.postRun, { cwd: catalogManager.getCwd() })
  }

  if (completeMessage) {
    if (commandOptions.install) {
      p.log.info(c.green(completeMessage))
      await runInstallCommand({
        cwd: catalogManager.getCwd(),
        packageManager: commandOptions.packageManager,
      })
    }
    else {
      p.outro(c.green(completeMessage))
    }
  }
}

export async function writeWorkspaceYaml(filepath: string, content: string) {
  p.log.info(`writing ${basename(filepath)}`)
  await writeFile(filepath, content, 'utf-8')
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

export async function writePackageJSON(filepath: string, content: PackageJson) {
  p.log.info('writing package.json')
  await writeJSON(filepath, cleanupPackageJSON(content))
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

export function generateWorkspaceYAML(dependencies: RawDep[], workspaceYaml: PnpmWorkspaceYaml) {
  const document = workspaceYaml.getDocument()
  document.deleteIn(['catalog'])
  document.deleteIn(['catalogs'])

  const catalogs: Record<string, Record<string, string>> = {}
  for (const dep of dependencies) {
    if (!catalogs[dep.catalogName])
      catalogs[dep.catalogName] = {}
    catalogs[dep.catalogName][dep.name] = dep.specifier
  }

  Object.entries(catalogs)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([catalogName, deps]) => {
      Object.entries(deps).forEach(([name, specifier]) => {
        if (catalogName === 'default')
          workspaceYaml.setPath(['catalog', name], specifier)
        else
          workspaceYaml.setPath(['catalogs', catalogName, name], specifier)
      })
    })
}

export function cleanupWorkspaceYAML(workspaceYaml: PnpmWorkspaceYaml) {
  const document = workspaceYaml.getDocument()
  const workspaceJson = workspaceYaml.toJSON()

  if (workspaceJson.catalog && !Object.keys(workspaceJson.catalog).length)
    document.deleteIn(['catalog'])

  if (workspaceJson.catalogs) {
    const emptyCatalogs: string[] = []
    for (const [catalogKey, catalogValue] of Object.entries(workspaceJson.catalogs)) {
      if (!catalogValue || Object.keys(catalogValue).length === 0)
        emptyCatalogs.push(catalogKey)
    }

    emptyCatalogs.forEach((key) => {
      document.deleteIn(['catalogs', key])
    })
  }

  const updatedWorkspaceJson = workspaceYaml.toJSON()
  if (!updatedWorkspaceJson.catalogs || Object.keys(updatedWorkspaceJson.catalogs).length === 0) {
    document.deleteIn(['catalogs'])
  }
}

export function removeWorkspaceYAMLDeps(dependencies: RawDep[], workspaceYaml: PnpmWorkspaceYaml) {
  const document = workspaceYaml.getDocument()
  dependencies.forEach((dep) => {
    if (dep.catalogName === 'default') {
      if (document.getIn(['catalog', dep.name]))
        document.deleteIn(['catalog', dep.name])
    }
    else
      if (document.getIn(['catalogs', dep.catalogName, dep.name])) {
        document.deleteIn(['catalogs', dep.catalogName, dep.name])
      }
  })
  cleanupWorkspaceYAML(workspaceYaml)
}
