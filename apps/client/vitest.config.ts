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
    // Coverage only runs under `npm run test:coverage`. The include globs are
    // deliberate: untested UI files count as 0% instead of being hidden.
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'constants/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.test.{ts,tsx}'],
    },
  },
});
