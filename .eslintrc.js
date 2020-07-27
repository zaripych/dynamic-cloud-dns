'use strict';

const { eslintConfig } = require('ts-deps');

module.exports = eslintConfig({
  src: {
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
});
