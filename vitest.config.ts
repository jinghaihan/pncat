import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    forceRerunTriggers: [
      'package.json',
      '**/{vitest,vite}.config.*',
    ],
    coverage: {
      include: ['./src'],
      exclude: [
        './src/**/*.d.ts',
        './src/cli.ts',
        './src/utils/npm.ts',
        './src/**/**/index.ts',
        './src/types/**',
        './src/constants/**',
      ],
      reportsDirectory: 'node_modules/.vitest/coverage',
    },
  },
})
