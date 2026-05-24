import { defineConfig } from 'vitest/config'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    tailwindcss(),
    storybookTest({ configDir: path.join(__dirname, '.storybook') }),
  ],
  resolve: {
    dedupe: ['@storybook/react', '@storybook/addon-vitest'],
  },
  test: {
    name: 'storybook',
    passWithNoTests: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
