import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'integration',
    include: ['lib/**/*.test.ts'],
    environment: 'node',
    env: {
      USE_PG_DRIVER: 'true',
      DATABASE_URL: 'postgresql://fenix_test:fenix_test@localhost:5433/fenix_test',
      DATABASE_URL_UNPOOLED: 'postgresql://fenix_test:fenix_test@localhost:5433/fenix_test',
    },
    pool: 'forks',
    testTimeout: 15_000,
  },
})
