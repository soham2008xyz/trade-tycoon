import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // react-native ships Flow-typed source that Rolldown/Vite cannot parse.
      // Map to react-native-web's compiled output for unit tests.
      'react-native': 'react-native-web',
    },
  },
});
