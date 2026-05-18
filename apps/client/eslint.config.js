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
      // Treat unused names prefixed with `_` as intentional. Lets us keep
      // parameter names as documentation in TypeScript callback signatures
      // (`onTilePress: (_tileId: string) => void`) without ESLint flagging
      // them as unused vars. Standard ESLint convention; Codacy also honors
      // it once configured here.
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
