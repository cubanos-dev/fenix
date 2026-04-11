import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      testIgnore: /member/,
      dependencies: ['setup'],
    },
    {
      name: 'member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/member.json',
      },
      testMatch: /member/,
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      USE_PG_DRIVER: 'true',
      DATABASE_URL: 'postgresql://fenix_test:fenix_test@localhost:5433/fenix_test',
      DATABASE_URL_UNPOOLED: 'postgresql://fenix_test:fenix_test@localhost:5433/fenix_test',
      SEED_DEV_USERS: 'true',
      BETTER_AUTH_SECRET: 'e2e-test-secret-not-for-production',
      BETTER_AUTH_URL: 'http://localhost:3001',
    },
  },
})
