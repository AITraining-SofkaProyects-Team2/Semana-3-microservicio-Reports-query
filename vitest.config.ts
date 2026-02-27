import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      reporter: ['lcov' ,'text', 'json', 'html', 'text-summary'],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
    environment: 'node',
  },
});
