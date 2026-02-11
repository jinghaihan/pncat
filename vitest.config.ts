import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      include: ['./src'],
      exclude: [
        './src/**/*.d.ts',
        './src/types/**',
        './src/constants/**',
        './src/commands/index.ts',
        './src/io/index.ts',
        './src/utils/index.ts',
      ],
      reportsDirectory: 'node_modules/.vitest/coverage',
    },
  },
})
