import { defineConfig } from 'vitest/config';

// Coverage only runs under `npm run test:coverage`; plain `npm test` stays fast.
// lcov is what the Codacy reporter uploads in CI (see .github/workflows/test.yml).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      include: ['src/**/*.ts'],
      // test-utils are helpers shared by the tests, not production code.
      exclude: ['src/**/*.test.ts', 'src/test-utils/**'],
    },
  },
});
