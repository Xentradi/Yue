'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const prettierConfig = require('eslint-config-prettier');
const pluginN = require('eslint-plugin-n');
const pluginPrettier = require('eslint-plugin-prettier');
const defineConfig = require('eslint/config').defineConfig;

module.exports = defineConfig([
  js.configs.recommended,
  prettierConfig,
  {
    ignores: ['build/', 'node_modules/', 'logs/'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    plugins: {
      n: pluginN,
      prettier: pluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error',
      'block-scoped-var': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'eol-last': 'error',
      'prefer-arrow-callback': 'error',
      'no-trailing-spaces': 'error',
      quotes: ['warn', 'single', { avoidEscape: true }],
      'no-restricted-properties': [
        'error',
        {
          object: 'describe',
          property: 'only',
        },
        {
          object: 'it',
          property: 'only',
        },
      ],
    },
  },
]);
