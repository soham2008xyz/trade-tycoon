import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // react-native ships Flow-typed source that Rolldown/Vite cannot parse.
      // Map to react-native-web's compiled output for unit tests.
      'react-native': 'react-native-web',
    },
  },
  test: {
    // Coverage only runs under `npm run test:coverage`. .tsx files (app routes
    // and components) are excluded: the suite runs in plain Node with no jsdom
    // or RTL, so UI can't be exercised here (see apps/client/AGENTS.md). Logic
    // lives in .ts helpers, which stay counted, including untested hooks.
    coverage: {
      provider: 'v8',
      reporter: ['lcovonly', 'text-summary'],
      include: ['components/**/*.ts', 'hooks/**/*.ts', 'constants/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.tsx'],
    },
  },
});
