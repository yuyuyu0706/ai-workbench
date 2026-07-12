import { defineConfig } from 'vitest/config';

const githubPagesBase = '/ai-workbench/';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? githubPagesBase : '/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
