import { defineConfig } from 'vitest/config'

export default defineConfig({
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
