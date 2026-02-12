import type { CatalogRule } from './types'

export const DEFAULT_CATALOG_RULES: CatalogRule[] = [
  {
    name: 'types',
    match: [/^@types\//],
    priority: 10,
  },
  {
    name: 'lint',
    match: [/(^|[@/.-])(eslint|prettier|stylelint|biome|knip|cspell|lint-staged)($|[@/.-])/],
    priority: 20,
  },
  {
    name: 'test',
    match: [/(^|[@/.-])(vitest|jest|cypress|playwright|test|testing)($|[@/.-])/],
    priority: 20,
  },
  {
    name: 'docs',
    match: [/(^|[@/.-])(vitepress|fumadocs|storybook)($|[@/.-])/],
    priority: 20,
  },
  {
    name: 'build',
    match: [/(^|[@/.-])(vite|webpack|rollup|rolldown|rspack|esbuild|tsup|tsdown|unplugin)($|[@/.-])/],
    priority: 20,
  },
  {
    name: 'icons',
    match: [/(^|[@/.-])(iconify|lucide|hugeicons|phosphor|remixicon|@tabler\/icons|tabler-icons)($|[@/.-])/],
    priority: 30,
  },
  {
    name: 'frontend',
    match: [/(^|[@/.-])(vue|pinia|@vueuse|react|zustand|redux|tailwindcss|unocss)($|[@/.-])/],
    priority: 30,
  },
  {
    name: 'backend',
    match: [/(^|[@/.-])(express|koa|nestjs|fastify|hono|prisma|drizzle|typeorm|kysely|postgres|pg|mysql2|sqlite|sqlite3|mongodb|redis|ioredis)($|[@/.-])/],
    priority: 30,
  },
]

export default DEFAULT_CATALOG_RULES
