import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    coverage: {
      include: ['./src'],
      exclude: [
        './src/**/*.d.ts',
        './src/types/**',
        './src/constants/**',
        './src/**/**/index.ts',
        './src/cli.ts',
      ],
      reportsDirectory: 'node_modules/.vitest/coverage',
    },
  },
})
