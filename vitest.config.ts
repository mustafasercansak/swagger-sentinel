import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/validators/**/*.test.ts'],
    environment: 'node',
  },
});
