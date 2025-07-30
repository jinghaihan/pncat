import type { PnpmWorkspaceYaml } from 'pnpm-workspace-yaml'
import type { CatalogOptions, ParsedSpec } from '../types'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { join } from 'pathe'
import { readPackageJSON, writePackageJSON } from 'pkg-types'
import { ensurePnpmWorkspaceYAML } from '../utils/ensure'
import { parseSpec } from '../utils/parse'
import { getDepCatalogName } from '../utils/rule'

interface ParsedDependencies {
  dependencies: ParsedSpec[]
  isDev: boolean
}

export async function addCommand(options: CatalogOptions) {
  // Get command line arguments (skip node and script name)
  const args = process.argv.slice(3)
  if (args.length === 0) {
    p.outro(c.red('no arguments provided, aborting'))
    process.exit(1)
  }

  const targetPackageJSON = join(process.cwd(), 'package.json')
  if (!targetPackageJSON) {
    p.outro(c.red('no package.json found, aborting'))
    process.exit(1)
  }
  const pkgJson = await readPackageJSON(targetPackageJSON)

  const { context: workspaceYaml, pnpmWorkspaceYamlPath } = await ensurePnpmWorkspaceYAML()

  // Process and validate arguments
  const config = await resolveDependencies(workspaceYaml, args, options)

  const contents: string[] = []
  for (const dep of config.dependencies) {
    const padEnd = Math.max(0, 20 - dep.name.length - (dep.specifier?.length || 0))
    const padCatalog = Math.max(0, 20 - (dep.catalog?.length ? (dep.catalog.length + ' catalog:'.length) : 0))
    contents.push([
      `${c.cyan(dep.name)}@${c.green(dep.specifier)} ${' '.repeat(padEnd)}`,
      dep.catalog ? c.yellow` catalog:${dep.catalog}` : '',
      ' '.repeat(padCatalog),
      dep.specifierSource ? c.gray(` (from ${dep.specifierSource})`) : '',
    ].join(' '))
  }
  p.note(c.reset(contents.join('\n')), `install packages to ${c.dim(pnpmWorkspaceYamlPath)}`)

  if (!options.yes) {
    const result = await p.confirm({
      message: c.green`looks good?`,
    })
    if (!result || p.isCancel(result)) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }
  }

  for (const dep of config.dependencies) {
    if (dep.catalog)
      workspaceYaml.setPackage(dep.catalog, dep.name, dep.specifier || '^0.0.0')
  }

  const depsName = config.isDev ? 'devDependencies' : 'dependencies'
  const depNameOppsite = config.isDev ? 'dependencies' : 'devDependencies'
  const deps = pkgJson[depsName] ||= {}
  for (const pkg of config.dependencies) {
    deps[pkg.name] = pkg.catalog ? (`catalog:${pkg.catalog}`) : pkg.specifier || '^0.0.0'
    if (pkgJson[depNameOppsite]?.[pkg.name])
      delete pkgJson[depNameOppsite][pkg.name]
  }

  p.log.info('writing pnpm-workspace.yaml')
  await writeFile(pnpmWorkspaceYamlPath, workspaceYaml.toString(), 'utf-8')
  p.log.info('writing package.json')
  await writePackageJSON(targetPackageJSON, pkgJson)
  p.log.info('done')

  p.log.success('add complete')

  if (options.install) {
    p.outro('running pnpm install')
    await execa('pnpm', ['install'], {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
    })
  }
}

async function resolveDependencies(
  workspaceYaml: PnpmWorkspaceYaml,
  args: string[],
  options: CatalogOptions,
): Promise<ParsedDependencies> {
  const isDev = ['--save-dev', '-D'].some(flag => args.includes(flag))

  // Extract dependency name (first non-flag argument)
  const dependencies = args.filter(arg => !arg.startsWith('-'))

  if (!dependencies.length) {
    p.outro(c.red('no dependency provided, aborting'))
    process.exit(1)
  }

  const workspaceJson = workspaceYaml.toJSON()

  const parsed = dependencies.map(x => x.trim()).filter(Boolean).map(parseSpec)
  for (const dep of parsed) {
    if (dep.specifier)
      dep.specifierSource ||= 'user'

    if (!dep.specifier) {
      const catalogs = workspaceYaml.getPackageCatalogs(dep.name)
      if (catalogs[0]) {
        dep.catalog = catalogs[0]
        dep.specifierSource ||= 'catalog'
      }
    }

    if (dep.catalog && !dep.specifier) {
      const spec = dep.catalog === 'default' ? workspaceJson?.catalog?.[dep.name] : workspaceJson?.catalogs?.[dep.catalog]?.[dep.name]
      if (spec) {
        dep.specifier = spec
        dep.specifierSource ||= 'catalog'
      }
    }

    if (!dep.specifier) {
      const spinner = p.spinner({ indicator: 'dots' })
      spinner.start(`resolving ${c.cyan(dep.name)} from npm...`)
      const { getLatestVersion } = await import('fast-npm-meta')
      const version = await getLatestVersion(dep.name)
      if (version.version) {
        dep.specifier = `^${version.version}`
        dep.specifierSource ||= 'npm'
        spinner.stop(c.gray`resolved ${c.cyan(dep.name)}@${c.green(dep.specifier)}`)
      }
      else {
        spinner.stop(`failed to resolve ${c.cyan(dep.name)} from npm`)
        p.outro(c.red('aborting'))
        process.exit(1)
      }
    }

    if (!dep.catalog)
      dep.catalog = determineCatalogName(dep.name, dep.specifier, isDev, options)
  }

  return {
    dependencies: parsed,
    isDev,
  }
}

function determineCatalogName(name: string, specifier: string, isDev: boolean, options: CatalogOptions): string {
  return getDepCatalogName({
    name,
    specifier,
    source: isDev ? 'devDependencies' : 'dependencies',
    catalog: true,
  }, options)
}
