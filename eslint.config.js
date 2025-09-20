// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'result/**']
  },

  // Base JS recommended rules
  js.configs.recommended,

  // Prettier config to disable stylistic rules that conflict
  prettierConfig,

  // TypeScript recommended (no type-checking, fast)
  ...tseslint.configs.recommended,

  // Project rules
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
        // If you want type-aware rules:
        // project: ['./tsconfig.json']
      }
    },
    plugins: {
      prettier
    },
    rules: {
      // Enforce single quotes, allow double quotes to avoid escape hell
      'quotes': ['error', 'single', { avoidEscape: true }],

      // Console is OK for CLI tools
      'no-console': 'off',

      // Use TS version of no-unused-vars
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Prefer `import type`
      '@typescript-eslint/consistent-type-imports': 'warn',

      // Practical in tooling scripts
      '@typescript-eslint/no-explicit-any': 'off',

      // Keep files clean
      'no-irregular-whitespace': 'error',

      // Prettier formatting as an ESLint rule (so --fix runs Prettier)
      'prettier/prettier': ['error', { printWidth: 110, singleQuote: true, trailingComma: 'none', semi: true }]
    }
  }
];
