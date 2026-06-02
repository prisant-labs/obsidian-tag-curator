import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    reporters: 'default',
  },
  resolve: {
    alias: {
      obsidian: resolve(__dirname, 'tests/_stubs/obsidian.ts'),
    },
  },
});
