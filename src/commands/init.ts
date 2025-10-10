import type { CatalogOptions, CatalogRule, SpecifierRule } from '../types'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { toArray } from '@antfu/utils'
import * as p from '@clack/prompts'
import c from 'ansis'
import { join } from 'pathe'
import { CatalogManager } from '../catalog-manager'
import { DEFAULT_CATALOG_RULES } from '../rules'
import { isDepMatched } from '../utils/catalog'

export async function initCommand(options: CatalogOptions) {
  const catalogManager = new CatalogManager(options)
  const cwd = catalogManager.getCwd()

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

  await catalogManager.loadPackages()
  const deps = catalogManager.getDepNames()

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

  const content = [
    `import { defineConfig } from 'pncat'`,
    ``,
    `export default defineConfig({`,
    `  catalogRules: [`,
    catalogRulesContent,
    `  ],`,
    `})`,
  ].join('\n')

  p.note(c.reset(catalogRules.map(rule => rule.name).join(', ')), `📋 Found ${c.yellow(catalogRules.length)} rules match current workspace`)
  if (!options.yes) {
    const result = await p.confirm({ message: `continue?` })
    if (!result || p.isCancel(result)) {
      p.outro(c.red('aborting'))
      process.exit(1)
    }
  }

  await writeFile(join(cwd, 'pncat.config.ts'), content)

  p.log.info(c.green(`setup complete`))
  p.outro(`Now you can update the dependencies by run ${c.green('pncat migrate')}${options.force ? c.green(' -f') : ''}\n`)
}
