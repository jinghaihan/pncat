import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { execa } from 'execa'
import { findUp } from 'find-up'
import { dirname, join } from 'pathe'
import { readPackageJSON, writePackageJSON } from 'pkg-types'
import { parsePnpmWorkspaceYaml } from 'pnpm-workspace-yaml'

export async function ensurePnpmWorkspaceYAML() {
  let pnpmWorkspaceYamlPath = await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
  if (!pnpmWorkspaceYamlPath) {
    const root = await findUp(['.git', 'pnpm-lock.yaml'], { cwd: process.cwd() })
      .then(r => r ? dirname(r) : process.cwd())
    p.log.warn(c.yellow('No pnpm-workspace.yaml found'))
    const result = await p.confirm({
      message: `do you want to create it under project root ${c.dim(root)} ?`,
    })
    if (!result) {
      p.outro(c.red('no pnpm-workspace.yaml found, aborting'))
      process.exit(1)
    }
    pnpmWorkspaceYamlPath = join(root, 'pnpm-workspace.yaml')
    await writeFile(pnpmWorkspaceYamlPath, 'packages: []')
  }

  const context = parsePnpmWorkspaceYaml(await readFile(pnpmWorkspaceYamlPath, 'utf-8'))

  return {
    context: context!,
    pnpmWorkspaceYamlPath: pnpmWorkspaceYamlPath!,
  }
}

export async function ensureDep(pkg: string, isDev: boolean = true) {
  const root = await findUp(['.git', 'package.json'], { cwd: process.cwd() })
    .then(r => r ? dirname(r) : process.cwd())
  const packageJSONPath = join(root, 'package.json')

  const pkgJson = await readPackageJSON(packageJSONPath)
  if ([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ].some(depNames => pkgJson[depNames]?.[pkg])) {
    return
  }

  const spinner = p.spinner({ indicator: 'dots' })
  const { getLatestVersion } = await import('fast-npm-meta')
  const version = await getLatestVersion(pkg)
  const depsName = isDev ? 'devDependencies' : 'dependencies'

  pkgJson[depsName] ??= {}
  if (version.version) {
    const specifier = `^${version.version}`
    pkgJson[depsName][pkg] = specifier
    spinner.stop(c.gray(`resolved ${c.cyan(pkg)}@${c.green(specifier)}`))
  }
  else {
    spinner.stop()
    p.outro(c.red(`failed to resolve ${c.cyan(pkg)} from npm`))
    process.exit(1)
  }

  await writePackageJSON(packageJSONPath, pkgJson)
  p.log.success(c.green(`Change wrote to package.json`))

  await execa('pnpm', ['install'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  })
  p.log.success(c.green(`Setup completed`))
}
