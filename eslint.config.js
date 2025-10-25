// Flat config for ESLint with Svelte + TypeScript
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**'],
  },
  js.configs.recommended,
  // Svelte rules + parser
  ...svelte.configs['flat/recommended'],
  // Svelte files: enable TS in <script lang="ts"> and allow browser/DOM globals
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        svelteFeatures: {
          runes: true, // Enable Svelte Runes syntax for linting
        },
      },
      globals: {
        ...globals.browser,
        Buffer: 'readonly', // Node.js global if needed
      },
    },
    rules: {
      // 空catchは許容
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // export した変数の型注釈内引数の誤検知を無効化
      'no-unused-vars': [
        'error',
        {
          args: 'none',
        },
      ],
    },
  },
  // TS/JS files
  {
    files: ['**/*.{ts,js}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module' },
      globals: {
        ...globals.browser,
        Buffer: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
];
