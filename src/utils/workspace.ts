import type { PackageJson } from 'pkg-types'
import type { PnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import type { PnpmCatalogManager } from '../pnpm-catalog-manager'
import type { CatalogOptions, PackageJsonMeta, RawDep } from '../types'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { join } from 'pathe'
import { readPackageJSON as _readPackageJSON, writePackageJSON as _writePackageJSON } from 'pkg-types'
import { DEPS_FIELDS } from '../constants'
import { runPnpmInstall } from './process'
import { diffYAML } from './yaml'

export interface ConfirmationOptions extends Pick<CatalogOptions, 'yes' | 'verbose'> {
  pnpmCatalogManager: PnpmCatalogManager
  workspaceYaml: PnpmWorkspaceYaml
  workspaceYamlPath: string
  updatedPackages?: Record<string, PackageJsonMeta>
  bailout?: boolean
  confirmMessage?: string
  completeMessage?: string
}

export async function confirmWorkspaceChanges(modifier: () => Promise<void>, options: ConfirmationOptions) {
  const {
    pnpmCatalogManager,
    workspaceYaml,
    workspaceYamlPath,
    updatedPackages,
    yes = false,
    verbose = false,
    bailout = true,
    confirmMessage = 'continue?',
    completeMessage,
  } = options ?? {}

  const commandOptions = pnpmCatalogManager.getOptions()

  const rawContent = workspaceYaml.toString()
  await modifier()
  const content = workspaceYaml.toString()

  if (rawContent === content) {
    if (bailout) {
      p.outro(c.yellow('no changes to pnpm-workspace.yaml'))
      process.exit(0)
    }
    else {
      p.log.info(c.green('no changes to pnpm-workspace.yaml'))
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
    await writePnpmWorkspace(workspaceYamlPath, content)
  }

  if (updatedPackages)
    await writePackageJSONs(updatedPackages!)

  if (completeMessage) {
    if (commandOptions.install) {
      p.log.info(c.green(completeMessage))
      await runPnpmInstall({ cwd: pnpmCatalogManager.getCwd() })
    }
    else {
      p.outro(c.green(completeMessage))
    }
  }
}

export async function writePnpmWorkspace(filePath: string, content: string) {
  p.log.info('writing pnpm-workspace.yaml')
  await writeFile(filePath, content, 'utf-8')
}

export async function readPackageJSON() {
  const pkgPath = join(process.cwd(), 'package.json')
  if (!existsSync(pkgPath)) {
    p.outro(c.red('no package.json found, aborting'))
    process.exit(1)
  }

  const pkgJson = await _readPackageJSON(pkgPath)
  if (typeof pkgJson.name !== 'string') {
    p.outro(c.red('package.json is missing name, aborting'))
    process.exit(1)
  }

  return { pkgPath, pkgJson }
}

export async function writePackageJSON(filepath: string, content: PackageJson) {
  p.log.info('writing package.json')
  await _writePackageJSON(filepath, cleanupPackageJSON(content))
}

export async function writePackageJSONs(updatedPackages: Record<string, PackageJsonMeta>): Promise<void> {
  if (Object.keys(updatedPackages).length === 0)
    return

  p.log.info('writing package.json')
  await Promise.all(
    Object.values(updatedPackages).map(pkg => _writePackageJSON(pkg.filepath, cleanupPackageJSON(pkg.raw))),
  )
}

function cleanupPackageJSON(pkgJson: PackageJson) {
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
    if (dep.catalogName === 'default')
      document.deleteIn(['catalog', dep.name])
    else
      document.deleteIn(['catalogs', dep.catalogName, dep.name])
  })
  cleanupWorkspaceYAML(workspaceYaml)
}
