import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['backend/tests/integration/**/*.test.ts'],
    globalSetup: ['backend/tests/setup/global-setup.ts'],
    setupFiles: ['backend/tests/setup/env.ts', 'backend/tests/setup/hooks.ts'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['backend/src/**/*.ts'],
      exclude: ['backend/src/server.ts'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
