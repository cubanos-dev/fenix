import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)', '../app/**/_components/**/*.stories.@(ts|tsx)'],

  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  framework: '@storybook/nextjs-vite',
}

export default config
