// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Turn off the legacy JS no-unused-vars rule on TS files — the TS
      // variant below replaces it and the JS one trips on TypeScript-only
      // syntax (e.g. parameter names in callback type signatures).
      'no-unused-vars': 'off',
      // Treat unused names prefixed with `_` as intentional. Lets us keep
      // parameter names as documentation in TypeScript callback signatures
      // (`onTilePress: (_tileId: string) => void`) without ESLint flagging
      // them as unused vars. Standard ESLint convention.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]);
