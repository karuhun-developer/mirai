import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{apps,packages,extensions}/**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
