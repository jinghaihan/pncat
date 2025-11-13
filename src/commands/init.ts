import type { PromptGroup } from '@clack/prompts'
import type { Agent, CatalogOptions, CatalogRule, SpecifierRule } from '../types'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import * as p from '@clack/prompts'
import c from 'ansis'
import { join } from 'pathe'
import { DEFAULT_CATALOG_RULES } from '../rules'
import { isDepMatched } from '../utils/catalog'
import { containsESLint, containsVSCodeExtension } from '../utils/contains'
import { Workspace } from '../workspace-manager'

interface PromptResults {
  mode?: string | symbol
  eslint?: boolean | symbol
}

const ESLINT_FIX_PATTERNS: Record<Agent, string> = {
  pnpm: '"**/package.json" "**/pnpm-workspace.yaml"',
  yarn: '"**/package.json" "**/.yarnrc.yml"',
  bun: '"**/package.json"',
  vlt: '"**/package.json" "**/vlt.json"',
}

function generateConfigContent(lines: string[]): string {
  return lines.filter((line, index) => (index === 1 || index === lines.length - 1) || Boolean(line)).join('\n')
}

async function generateConfigLines(lines: string[], workspace: Workspace, results: PromptResults): Promise<string[]> {
  const { eslint = false } = results
  const options = workspace.getOptions()
  const agent = options.agent || 'pnpm'

  const packages = await workspace.loadPackages()

  const start = lines.findIndex(line => line === `export default defineConfig({`)
  const end = lines.findIndex(line => line === `})`)

  if (eslint)
    lines.splice(end, 0, `  postRun: 'eslint --fix ${ESLINT_FIX_PATTERNS[agent]}',`)

  if (containsVSCodeExtension(packages))
    lines.splice(start + 1, 0, `  exclude: ['@types/vscode'],`)

  return lines
}

async function generateExtendConfig(workspace: Workspace, results: PromptResults): Promise<string> {
  const lines = await generateConfigLines([
    `import { defineConfig, mergeCatalogRules } from 'pncat'`,
    ``,
    `export default defineConfig({`,
    `  catalogRules: mergeCatalogRules([]),`,
    `})`,
    ``,
  ], workspace, results)

  return generateConfigContent(lines)
}

async function genereateMinimalConfig(workspace: Workspace, results: PromptResults): Promise<string> {
  const options = workspace.getOptions()

  const deps = workspace.getDepNames()

  const rulesMap = new Map<string, CatalogRule>()
  const rules = options.catalogRules?.length ? options.catalogRules : DEFAULT_CATALOG_RULES

  for (const rule of rules) {
    for (const dep of deps) {
      const matches = toArray(rule.match)
      matches.forEach((match) => {
        if (isDepMatched(dep, match)) {
          if (!rulesMap.has(rule.name)) {
            rulesMap.set(rule.name, {
              ...rule,
              match: [],
            })
          }
          const store = rulesMap.get(rule.name)!
          const storeMatch = toArray(store.match ?? [])
          rulesMap.set(rule.name, {
            ...rule,
            match: [...new Set([...storeMatch, match])],
          })
        }
      })
    }
  }

  const catalogRules = Array.from(rulesMap.values())

  const serializeMatch = (match: string | RegExp | (string | RegExp)[]): string => {
    const matches = toArray(match)
    return `[${matches.map((m) => {
      if (m instanceof RegExp)
        return m.toString()
      return `'${m}'`
    }).join(', ')}]`
  }

  const serializeSpecifierRules = (rules: SpecifierRule[]): string => {
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

  const formatRuleObject = (fields: string[]): string => {
    return [
      '    {',
      ...fields.map((field, index) => `      ${field}${index < fields.length - 1 ? ',' : ''}`),
      '    }',
    ].join('\n')
  }

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

  const lines = await generateConfigLines([
    `import { defineConfig } from 'pncat'`,
    ``,
    `export default defineConfig({`,
    `  catalogRules: [`,
    catalogRulesContent,
    `  ],`,
    `})`,
    ``,
  ], workspace, results)

  p.note(c.reset(catalogRules.map(rule => rule.name).join(', ')), `📋 Found ${c.yellow(catalogRules.length)} rules match current workspace`)
  if (!options.yes) {
    const result = await p.confirm({ message: `continue?` })
    if (!result || p.isCancel(result)) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }
  }

  return generateConfigContent(lines)
}

export async function initCommand(options: CatalogOptions) {
  const workspace = new Workspace(options)
  const cwd = workspace.getCwd()

  if (existsSync(join(cwd, 'pncat.config.ts'))) {
    const result = await p.confirm({
      message: `${c.yellow('pncat.config.ts')} already exists, do you want to overwrite it?`,
      initialValue: false,
    })
    if (!result || p.isCancel(result)) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }
  }

  const prompts: PromptGroup<PromptResults> = {
    mode: () => p.select({
      message: `select configuration mode`,
      options: [
        {
          value: 'extend',
          hint: 'extend default rules with workspace-specific rules',
        },
        {
          value: 'minimal',
          hint: 'only include rules that match current workspace dependencies',
        },
      ],
      initialValue: 'extend',
    }),
    eslint: () => p.confirm({
      message: 'do you want to run eslint --fix after command complete?',
      initialValue: true,
    }),
  }

  const packages = await workspace.loadPackages()
  if (!containsESLint(packages))
    delete prompts.eslint

  const results: PromptResults = await p.group(
    prompts,
    {
      onCancel: () => {
        p.outro(c.red('aborting'))
        process.exit(1)
      },
    },
  )

  const content = results.mode === 'extend'
    ? await generateExtendConfig(workspace, results)
    : await genereateMinimalConfig(workspace, results)

  await writeFile(join(cwd, 'pncat.config.ts'), content)

  p.log.info(c.green(`init complete`))
  p.outro(`now you can update the dependencies by run ${c.green('pncat migrate')}${options.force ? c.green(' -f') : ''}\n`)
}
