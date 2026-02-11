import type { CatalogOptions, CatalogRule, PackageManager, SpecifierRule } from '../types'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { toArray } from '@antfu/utils'
import * as p from '@clack/prompts'
import c from 'ansis'
import { join } from 'pathe'
import { DEFAULT_CATALOG_RULES } from '../rules'
import { isDepMatched } from '../utils'
import { WorkspaceManager } from '../workspace-manager'

const INIT_CONFIG_FILENAME = 'pncat.config.ts'
type InitMode = 'extend' | 'minimal'

const ESLINT_FIX_PATTERNS: Record<PackageManager, string> = {
  pnpm: '"**/package.json" "**/pnpm-workspace.yaml"',
  yarn: '"**/package.json" "**/.yarnrc.yml"',
  bun: '"**/package.json"',
  vlt: '"**/package.json" "**/vlt.json"',
}

export async function initCommand(options: CatalogOptions): Promise<void> {
  const workspace = new WorkspaceManager(options)
  const cwd = workspace.getCwd()
  const filepath = join(cwd, INIT_CONFIG_FILENAME)

  if (existsSync(filepath) && !options.yes) {
    const confirmed = await p.confirm({
      message: `${c.yellow(INIT_CONFIG_FILENAME)} already exists, do you want to overwrite it?`,
      initialValue: false,
    })

    if (p.isCancel(confirmed) || !confirmed) {
      p.outro(c.red('aborting'))
      return
    }
  }

  await workspace.loadPackages()

  const mode = await promptInitMode(options)
  if (!mode)
    return

  const eslint = await promptEslintFix(options, workspace)
  if (eslint === null)
    return

  const content = mode === 'extend'
    ? generateExtendConfig(options, workspace, eslint)
    : await generateMinimalConfig(options, workspace, eslint)

  if (!content)
    return

  await writeFile(filepath, content, 'utf-8')

  p.log.info(c.green('init complete'))
  p.outro(`now you can update the dependencies by run ${c.green('pncat migrate')}${options.force ? c.green(' -f') : ''}\n`)
}

async function promptInitMode(options: CatalogOptions): Promise<InitMode | null> {
  if (options.yes)
    return 'extend'

  const mode = await p.select({
    message: 'select configuration mode',
    options: [
      {
        label: 'extend',
        value: 'extend',
        hint: 'extend default rules with workspace-specific rules',
      },
      {
        label: 'minimal',
        value: 'minimal',
        hint: 'only include rules matching current workspace dependencies',
      },
    ],
    initialValue: 'extend',
  })

  if (p.isCancel(mode)) {
    p.outro(c.red('aborting'))
    return null
  }

  if (mode !== 'extend' && mode !== 'minimal') {
    p.outro(c.red('aborting'))
    return null
  }

  return mode
}

async function promptEslintFix(options: CatalogOptions, workspace: WorkspaceManager): Promise<boolean | null> {
  if (!workspace.hasEslint())
    return false

  if (options.yes)
    return true

  const enabled = await p.confirm({
    message: 'do you want to run eslint --fix after command complete?',
    initialValue: true,
  })

  if (p.isCancel(enabled)) {
    p.outro(c.red('aborting'))
    return null
  }

  return !!enabled
}

function generateExtendConfig(options: CatalogOptions, workspace: WorkspaceManager, eslint: boolean): string {
  const lines = injectCommonConfigLines([
    `import { defineConfig, mergeCatalogRules } from 'pncat'`,
    ``,
    `export default defineConfig({`,
    `  catalogRules: mergeCatalogRules([]),`,
    `})`,
    ``,
  ], options, workspace, eslint)

  return generateConfigContent(lines)
}

async function generateMinimalConfig(options: CatalogOptions, workspace: WorkspaceManager, eslint: boolean): Promise<string | null> {
  const depNames = workspace.getDepNames()
  const catalogRules = collectMatchedRules(depNames, options)

  p.note(c.reset(catalogRules.map(rule => rule.name).join(', ')), `found ${c.yellow(catalogRules.length)} matching rules`)
  if (!options.yes) {
    const confirmed = await p.confirm({ message: 'continue?' })
    if (p.isCancel(confirmed) || !confirmed) {
      p.outro(c.red('aborting'))
      return null
    }
  }

  const lines = [
    `import { defineConfig } from 'pncat'`,
    ``,
    `export default defineConfig({`,
  ]

  if (catalogRules.length === 0) {
    lines.push(`  catalogRules: [],`)
  }
  else {
    const catalogRulesContent = catalogRules.map((rule) => {
      const fields = [
        `name: '${rule.name}'`,
        `match: ${serializeMatch(rule.match)}`,
        rule.depFields ? `depFields: ${JSON.stringify(rule.depFields)}` : '',
        rule.priority ? `priority: ${rule.priority}` : '',
        rule.specifierRules ? `specifierRules: ${serializeSpecifierRules(rule.specifierRules)}` : '',
      ].filter(Boolean)

      return formatRuleObject(fields)
    }).join(',\n')

    lines.push(`  catalogRules: [`)
    lines.push(catalogRulesContent)
    lines.push(`  ],`)
  }

  lines.push(`})`)
  lines.push(``)

  return generateConfigContent(injectCommonConfigLines(lines, options, workspace, eslint))
}

function injectCommonConfigLines(lines: string[], options: CatalogOptions, workspace: WorkspaceManager, eslint: boolean): string[] {
  const closeIndex = lines.lastIndexOf('})')
  if (closeIndex < 0)
    return lines

  const inserts: string[] = []
  if (workspace.hasVSCodeEngine())
    inserts.push(`  exclude: ['@types/vscode'],`)

  if (eslint) {
    const agent = options.agent || 'pnpm'
    inserts.push(`  postRun: 'eslint --fix ${ESLINT_FIX_PATTERNS[agent]}',`)
  }

  if (inserts.length > 0)
    lines.splice(closeIndex, 0, ...inserts)

  return lines
}

function generateConfigContent(lines: string[]): string {
  return lines.filter((line, index) => (index === 1 || index === lines.length - 1) || Boolean(line)).join('\n')
}

function collectMatchedRules(depNames: string[], options: CatalogOptions): CatalogRule[] {
  const rules = options.catalogRules?.length ? options.catalogRules : DEFAULT_CATALOG_RULES
  const rulesMap = new Map<string, CatalogRule & { match: (string | RegExp)[] }>()

  for (const rule of rules) {
    for (const depName of depNames) {
      for (const match of toArray(rule.match)) {
        if (!isDepMatched(depName, match))
          continue

        if (!rulesMap.has(rule.name)) {
          rulesMap.set(rule.name, {
            ...rule,
            match: [],
          })
        }

        const storedRule = rulesMap.get(rule.name)!
        const exists = storedRule.match.some(item => item.toString() === match.toString())
        if (!exists)
          storedRule.match.push(match)
      }
    }
  }

  return Array.from(rulesMap.values())
}

function serializeMatch(match: string | RegExp | (string | RegExp)[]): string {
  const matches = toArray(match)
  return `[${matches.map((item) => {
    if (item instanceof RegExp)
      return item.toString()

    return `'${item.replaceAll('\'', '\\\'')}'`
  }).join(', ')}]`
}

function serializeSpecifierRules(rules: SpecifierRule[]): string {
  return `[${rules.map((rule) => {
    const parts = [`specifier: '${rule.specifier}'`]
    if (rule.match)
      parts.push(`match: ${serializeMatch(rule.match)}`)
    if (rule.name)
      parts.push(`name: '${rule.name}'`)
    if (rule.suffix)
      parts.push(`suffix: '${rule.suffix}'`)
    return `{ ${parts.join(', ')} }`
  }).join(', ')}]`
}

function formatRuleObject(fields: string[]): string {
  return [
    '    {',
    ...fields.map((field, index) => `      ${field}${index < fields.length - 1 ? ',' : ''}`),
    '    }',
  ].join('\n')
}
